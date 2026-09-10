from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.core.dependencies import obter_auth_service
from app.main import app
from app.repositories.sessoes_exercicio_repository import SessaoExercicioRegisto
from app.routers.sessoes_exercicio import obter_sessoes_exercicio_repository
from app.services.auth_service import AuthService
from tests.services.test_auth_service import RepositorioFalso


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
    with TestClient(app) as c:
        yield c, repo_sessoes
    app.dependency_overrides.clear()


def _registar(c: TestClient) -> str:
    r = c.post("/auth/registar", json={"email": "ana@example.com", "password": "password-forte-123"})
    return r.json()["id"]


def test_sem_sessao_devolve_401(ambiente) -> None:
    c, _ = ambiente
    assert c.post("/sessoes-exercicio", json={"exercicio_id": "tracking", "duracao_segundos": 60}).status_code == 401


def test_grava_com_user_id_do_jwt_ignorando_o_do_corpo(ambiente) -> None:
    c, repo = ambiente
    utilizador_id = _registar(c)

    resposta = c.post(
        "/sessoes-exercicio",
        json={
            "exercicio_id": "tracking",
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
        "/sessoes-exercicio", json={"exercicio_id": "relaxamento", "duracao_segundos": 120}
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
    try:
        with TestClient(app, raise_server_exceptions=False) as c:
            _registar(c)
            resposta = c.post(
                "/sessoes-exercicio", json={"exercicio_id": "tracking", "duracao_segundos": 60}
            )
    finally:
        app.dependency_overrides.clear()

    assert resposta.status_code == 500
    assert resposta.status_code != 201
    assert repo_sessoes.gravadas == []
