from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.core.dependencies import (
    obter_auth_service,
    obter_confirmacao_email_service,
    obter_conta_service,
)
from app.main import app
from app.repositories.sessoes_exercicio_repository import SessaoExercicioRegisto
from app.routers.exercicios import obter_acesso_exercicios_service
from app.routers.sessoes_exercicio import obter_sessoes_exercicio_repository
from app.services.acesso_exercicios_service import AcessoExerciciosService
from app.services.auth_service import AuthService
from app.services.confirmacao_email_service import ConfirmacaoEmailService
from app.services.conta_service import ContaService
from tests.services.test_acesso_exercicios_service import RepositorioAcessoFalso, _conta
from tests.services.test_auth_service import RepositorioFalso
from tests.services.test_confirmacao_email_service import TokensConfirmacaoRepositorioFalso
from tests.services.test_recuperacao_password_service import EmailSenderFalso


def _acesso_premium() -> AcessoExerciciosService:
    return AcessoExerciciosService(
        RepositorioAcessoFalso(
            _conta(premium_ativo=True, premium_expira_em=datetime.now(UTC) + timedelta(days=30))
        )
    )


class RepositorioSessoesFalso:
    def __init__(self) -> None:
        self.gravadas: list[dict] = []
        self.a_falhar = False

    def criar(
        self,
        user_id: str,
        exercicio_id: str,
        duracao_segundos: int,
        pontuacao: int,
        precisao_percentual: float,
        detalhes: dict | None,
    ) -> SessaoExercicioRegisto:
        if self.a_falhar:
            raise RuntimeError("falha simulada na gravação")
        registo = {
            "user_id": user_id,
            "exercicio_id": exercicio_id,
            "duracao_segundos": duracao_segundos,
            "pontuacao": pontuacao,
            "precisao_percentual": precisao_percentual,
            "detalhes": detalhes,
        }
        self.gravadas.append(registo)
        return SessaoExercicioRegisto(
            id=f"sessao-{len(self.gravadas)}", created_at=datetime.now(UTC), **registo
        )


@pytest.fixture
def ambiente():
    repo_auth = RepositorioFalso()
    repo_sessoes = RepositorioSessoesFalso()
    app.dependency_overrides[obter_auth_service] = lambda: AuthService(repo_auth)
    app.dependency_overrides[obter_sessoes_exercicio_repository] = lambda: repo_sessoes
    app.dependency_overrides[obter_acesso_exercicios_service] = _acesso_premium
    # /auth/entrar também chama o ContaService (cancelar eliminação
    # agendada) -- sem isto cairia no repositório real.
    app.dependency_overrides[obter_conta_service] = lambda: ContaService(repo_auth)
    # /auth/registar manda sempre um email de confirmação (AUTH-02) -- sem
    # este override, cairia no repositório/email real (Postgres inexistente
    # em testes).
    app.dependency_overrides[obter_confirmacao_email_service] = lambda: ConfirmacaoEmailService(
        repo_auth, TokensConfirmacaoRepositorioFalso(), EmailSenderFalso()
    )
    with TestClient(app) as c:
        c.repo_auth = repo_auth  # type: ignore[attr-defined]
        yield c, repo_sessoes
    app.dependency_overrides.clear()


def _registar(c: TestClient) -> str:
    # AUTH-02: registar já não inicia sessão -- confirma no repositório
    # falso e entra a seguir (o fluxo de token por email é testado à parte).
    r = c.post("/auth/registar", json={"email": "ana@example.com", "password": "password-forte-123"})
    utilizador_id = r.json()["id"]
    c.repo_auth.confirmar_email(utilizador_id)  # type: ignore[attr-defined]
    c.post("/auth/entrar", json={"email": "ana@example.com", "password": "password-forte-123"})
    return utilizador_id


def test_sem_sessao_devolve_401(ambiente) -> None:
    c, _ = ambiente
    assert c.post("/sessoes-exercicio", json={"exercicio_id": "figure8", "duracao_segundos": 60}).status_code == 401


def test_grava_com_user_id_do_jwt_ignorando_o_do_corpo(ambiente) -> None:
    c, repo = ambiente
    utilizador_id = _registar(c)

    resposta = c.post(
        "/sessoes-exercicio",
        json={
            "exercicio_id": "figure8",
            "duracao_segundos": 90,
            "pontuacao": 42,
            "precisao_percentual": 87.5,
            "user_id": "00000000-0000-0000-0000-000000000000",  # forjado — deve ser ignorado
        },
    )

    assert resposta.status_code == 201
    assert resposta.json()["user_id"] == utilizador_id
    assert repo.gravadas[0]["user_id"] == utilizador_id


def test_pontuacao_e_precisao_omitidas_ficam_a_zero(ambiente) -> None:
    c, repo = ambiente
    _registar(c)

    resposta = c.post(
        "/sessoes-exercicio", json={"exercicio_id": "relax", "duracao_segundos": 120}
    )

    assert resposta.status_code == 201
    assert repo.gravadas[0]["pontuacao"] == 0
    assert repo.gravadas[0]["precisao_percentual"] == 0


def test_duracao_invalida_devolve_422(ambiente) -> None:
    c, _ = ambiente
    _registar(c)
    assert c.post("/sessoes-exercicio", json={"exercicio_id": "x", "duracao_segundos": 0}).status_code == 422
    assert c.post("/sessoes-exercicio", json={"exercicio_id": "x"}).status_code == 422


def test_nunca_201_quando_a_gravacao_falha() -> None:
    repo_auth = RepositorioFalso()
    repo_sessoes = RepositorioSessoesFalso()
    repo_sessoes.a_falhar = True
    app.dependency_overrides[obter_auth_service] = lambda: AuthService(repo_auth)
    app.dependency_overrides[obter_sessoes_exercicio_repository] = lambda: repo_sessoes
    app.dependency_overrides[obter_acesso_exercicios_service] = _acesso_premium
    app.dependency_overrides[obter_conta_service] = lambda: ContaService(repo_auth)
    app.dependency_overrides[obter_confirmacao_email_service] = lambda: ConfirmacaoEmailService(
        repo_auth, TokensConfirmacaoRepositorioFalso(), EmailSenderFalso()
    )
    try:
        with TestClient(app, raise_server_exceptions=False) as c:
            c.repo_auth = repo_auth  # type: ignore[attr-defined]
            _registar(c)
            resposta = c.post(
                "/sessoes-exercicio", json={"exercicio_id": "figure8", "duracao_segundos": 60}
            )
    finally:
        app.dependency_overrides.clear()

    assert resposta.status_code == 500
    assert resposta.status_code != 201
    assert repo_sessoes.gravadas == []


def _com_acesso(conta) -> None:
    app.dependency_overrides[obter_acesso_exercicios_service] = lambda: AcessoExerciciosService(
        RepositorioAcessoFalso(conta)
    )


def test_sem_trial_nem_premium_devolve_403_e_nao_grava(ambiente) -> None:
    c, repo = ambiente
    _registar(c)
    _com_acesso(_conta())  # trial disponível, nunca iniciado
    resposta = c.post("/sessoes-exercicio", json={"exercicio_id": "figure8", "duracao_segundos": 60})
    assert resposta.status_code == 403
    assert repo.gravadas == []


def test_trial_ativo_grava_exercicio_do_trial_mas_nao_premium(ambiente) -> None:
    c, repo = ambiente
    _registar(c)
    agora = datetime.now(UTC)
    _com_acesso(_conta(trial_iniciado_em=agora, trial_termina_em=agora + timedelta(days=7)))
    assert c.post("/sessoes-exercicio", json={"exercicio_id": "cerebro", "duracao_segundos": 60}).status_code == 201
    assert c.post("/sessoes-exercicio", json={"exercicio_id": "ambliopia", "duracao_segundos": 60}).status_code == 403
    assert [g["exercicio_id"] for g in repo.gravadas] == ["cerebro"]


def test_trial_terminado_devolve_403(ambiente) -> None:
    c, repo = ambiente
    _registar(c)
    agora = datetime.now(UTC)
    _com_acesso(_conta(trial_iniciado_em=agora - timedelta(days=8), trial_termina_em=agora - timedelta(days=1)))
    assert c.post("/sessoes-exercicio", json={"exercicio_id": "figure8", "duracao_segundos": 60}).status_code == 403
    assert repo.gravadas == []


def test_exercicio_eliminado_devolve_403_mesmo_para_premium(ambiente) -> None:
    c, repo = ambiente
    _registar(c)
    resposta = c.post("/sessoes-exercicio", json={"exercicio_id": "programa-ia", "duracao_segundos": 60})
    assert resposta.status_code == 403
    assert repo.gravadas == []
