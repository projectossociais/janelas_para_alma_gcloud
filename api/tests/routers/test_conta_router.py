import pytest
from fastapi.testclient import TestClient

from app.core.dependencies import (
    obter_auth_service,
    obter_confirmacao_email_service,
    obter_conta_service,
)
from app.main import app
from app.services.auth_service import AuthService
from app.services.confirmacao_email_service import ConfirmacaoEmailService
from app.services.conta_service import ContaService
from tests.services.test_auth_service import RepositorioFalso
from tests.services.test_confirmacao_email_service import TokensConfirmacaoRepositorioFalso
from tests.services.test_recuperacao_password_service import EmailSenderFalso


@pytest.fixture
def client():
    repo = RepositorioFalso()
    app.dependency_overrides[obter_auth_service] = lambda: AuthService(repo)
    app.dependency_overrides[obter_conta_service] = lambda: ContaService(repo)
    # /auth/registar manda sempre um email de confirmação (AUTH-02) -- sem
    # este override, cairia no repositório/email real (Postgres inexistente
    # em testes). O conteúdo do email não interessa aqui, só que não rebente.
    app.dependency_overrides[obter_confirmacao_email_service] = lambda: ConfirmacaoEmailService(
        repo, TokensConfirmacaoRepositorioFalso(), EmailSenderFalso()
    )
    with TestClient(app) as c:
        c.repo = repo  # type: ignore[attr-defined]
        yield c
    app.dependency_overrides.clear()


def _registar(client: TestClient) -> None:
    # AUTH-02: registar já não inicia sessão -- confirma directamente no
    # repositório falso (sem passar pelo email/token, isso é testado à
    # parte) e entra a seguir, para este helper continuar a devolver uma
    # sessão activa como fazia antes.
    resposta = client.post("/auth/registar", json={"email": "ana@example.com", "password": "password-forte-123"})
    client.repo.confirmar_email(resposta.json()["id"])  # type: ignore[attr-defined]
    client.post("/auth/entrar", json={"email": "ana@example.com", "password": "password-forte-123"})


class TestMudarPassword:
    def test_muda_a_password_e_o_login_seguinte_usa_a_nova(self, client: TestClient) -> None:
        _registar(client)

        resposta = client.post(
            "/conta/mudar-password", json={"password_atual": "password-forte-123", "password_nova": "nova-pass-456"}
        )
        assert resposta.status_code == 204

        client.cookies.clear()
        resposta_login = client.post("/auth/entrar", json={"email": "ana@example.com", "password": "nova-pass-456"})
        assert resposta_login.status_code == 200

    def test_recusa_com_password_atual_errada(self, client: TestClient) -> None:
        _registar(client)

        resposta = client.post(
            "/conta/mudar-password", json={"password_atual": "errada", "password_nova": "nova-pass-456"}
        )

        assert resposta.status_code == 401

    def test_recusa_sem_sessao(self, client: TestClient) -> None:
        resposta = client.post(
            "/conta/mudar-password", json={"password_atual": "x", "password_nova": "nova-pass-456"}
        )

        assert resposta.status_code == 401


class TestEliminarConta:
    def test_agenda_para_daqui_a_30_dias_e_termina_a_sessao(self, client: TestClient) -> None:
        _registar(client)

        resposta = client.post("/conta/eliminar")

        assert resposta.status_code == 200
        assert "agendada_para" in resposta.json()
        # a sessão foi terminada -- /auth/eu já não reconhece o cookie
        assert client.get("/auth/eu").status_code == 401

    def test_sem_sessao_devolve_401(self, client: TestClient) -> None:
        resposta = client.post("/conta/eliminar")

        assert resposta.status_code == 401


def test_voltar_a_entrar_cancela_a_eliminacao_agendada(client: TestClient) -> None:
    _registar(client)
    client.post("/conta/eliminar")
    client.cookies.clear()

    resposta = client.post("/auth/entrar", json={"email": "ana@example.com", "password": "password-forte-123"})

    assert resposta.status_code == 200
    assert resposta.json()["eliminacao_cancelada"] is True


def test_entrar_sem_eliminacao_agendada_nao_marca_cancelada(client: TestClient) -> None:
    _registar(client)
    client.cookies.clear()

    resposta = client.post("/auth/entrar", json={"email": "ana@example.com", "password": "password-forte-123"})

    assert resposta.json()["eliminacao_cancelada"] is False
