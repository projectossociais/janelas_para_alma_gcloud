from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.core.dependencies import obter_auth_service
from app.main import app
from app.repositories.perfil_repository import PerfilRegisto
from app.routers import perfil as perfil_router
from app.services.auth_service import AuthService
from app.services.perfil_service import PerfilService
from tests.services.test_auth_service import RepositorioFalso
from tests.services.test_perfil_service import RepositorioPerfilFalso


@pytest.fixture
def client():
    repo_auth = RepositorioFalso()
    repo_perfil = RepositorioPerfilFalso()
    app.dependency_overrides[obter_auth_service] = lambda: AuthService(repo_auth)
    app.dependency_overrides[perfil_router.obter_perfil_service] = lambda: PerfilService(repo_perfil)
    with TestClient(app) as c:
        yield c, repo_perfil
    app.dependency_overrides.clear()


def _registar_e_ligar_perfil(client_tuple: tuple[TestClient, RepositorioPerfilFalso]) -> tuple[TestClient, str]:
    """Regista um utilizador na API e faz corresponder uma linha de perfil
    falsa ao mesmo id — os dois repositórios (auth e perfil) são falsos e
    independentes, tal como os reais são duas fatias da mesma tabela."""
    client, repo_perfil = client_tuple
    resposta = client.post("/auth/registar", json={"email": "ana@example.com", "password": "password-forte-123"})
    utilizador_id = resposta.json()["id"]

    repo_perfil._perfis[utilizador_id] = PerfilRegisto(
        id=utilizador_id,
        email="ana@example.com",
        papel="comum",
        nome_completo=None,
        biografia=None,
        telefone=None,
        data_nascimento=None,
        genero=None,
        provincia=None,
        avatar_url=None,
        premium_ativo=False,
        premium_expira_em=None,
        notificacoes_projetos=False,
        notificacoes_lembretes=False,
        notificacoes_comunidade=False,
        criado_em=datetime.now(UTC),
    )
    return client, utilizador_id


def test_obter_perfil_sem_sessao_devolve_401(client: tuple[TestClient, RepositorioPerfilFalso]) -> None:
    c, _ = client
    assert c.get("/perfil").status_code == 401


def test_obter_perfil_com_sessao(client: tuple[TestClient, RepositorioPerfilFalso]) -> None:
    c, _ = _registar_e_ligar_perfil(client)

    resposta = c.get("/perfil")

    assert resposta.status_code == 200
    assert resposta.json()["email"] == "ana@example.com"


def test_atualizar_perfil_muda_so_os_campos_enviados(client: tuple[TestClient, RepositorioPerfilFalso]) -> None:
    c, _ = _registar_e_ligar_perfil(client)

    resposta = c.patch("/perfil", json={"biografia": "Olá, sou a Ana", "telefone": "923000000"})

    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["biografia"] == "Olá, sou a Ana"
    assert corpo["telefone"] == "923000000"


def test_atualizar_perfil_nunca_aceita_mudar_papel_ou_email(client: tuple[TestClient, RepositorioPerfilFalso]) -> None:
    c, _ = _registar_e_ligar_perfil(client)

    resposta = c.patch("/perfil", json={"papel": "admin", "email": "outra@example.com", "biografia": "x"})

    # O schema simplesmente ignora campos desconhecidos (não são parte de
    # PerfilAtualizar) — nunca chegam ao service, muito menos à base de dados.
    assert resposta.status_code == 200
    assert resposta.json()["papel"] == "comum"
    assert resposta.json()["email"] == "ana@example.com"


def test_atualizar_perfil_sem_sessao_devolve_401(client: tuple[TestClient, RepositorioPerfilFalso]) -> None:
    c, _ = client
    resposta = c.patch("/perfil", json={"biografia": "x"})

    assert resposta.status_code == 401
