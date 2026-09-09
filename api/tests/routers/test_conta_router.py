import pytest
from fastapi.testclient import TestClient

from app.core.dependencies import obter_auth_service, obter_conta_service
from app.main import app
from app.services.auth_service import AuthService
from app.services.conta_service import ContaService
from tests.services.test_auth_service import RepositorioFalso


@pytest.fixture
def client():
    repo = RepositorioFalso()
    app.dependency_overrides[obter_auth_service] = lambda: AuthService(repo)
    app.dependency_overrides[obter_conta_service] = lambda: ContaService(repo)
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def _registar(client: TestClient) -> None:
    client.post("/auth/registar", json={"email": "ana@example.com", "password": "password-forte-123"})


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
