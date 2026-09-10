from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.core.dependencies import obter_auth_service
from app.core.security import criar_access_token, hash_password
from app.main import app
from app.repositories.utilizadores_repository import UtilizadorRegisto
from app.routers import admin as admin_router
from app.services.admin_service import AdminService
from app.services.auth_service import AuthService
from tests.services.test_admin_service import RepositorioAdminFalso, _u
from tests.services.test_auth_service import RepositorioFalso as RepositorioAuthFalso


def _seed(repo_auth: RepositorioAuthFalso, id_: str, papel: str) -> str:
    repo_auth._utilizadores[f"{id_}@example.com"] = UtilizadorRegisto(
        id=id_,
        email=f"{id_}@example.com",
        password_hash=hash_password("password-forte-123"),
        papel=papel,
        nome_completo=None,
        provincia=None,
        genero=None,
        criado_em=datetime.now(UTC),
    )
    return criar_access_token(id_)


@pytest.fixture
def ambiente():
    repo_auth = RepositorioAuthFalso()
    # id-admin corresponde ao executor; a lista do repo de admin espelha-o.
    repo_admin = RepositorioAdminFalso(
        [_u("id-admin", "admin", "id-admin@example.com"), _u("u-comum", "comum", "rui@example.com")]
    )
    token_admin = _seed(repo_auth, "id-admin", "admin")
    token_comum = _seed(repo_auth, "id-comum", "comum")
    app.dependency_overrides[obter_auth_service] = lambda: AuthService(repo_auth)
    app.dependency_overrides[admin_router.obter_admin_repository] = lambda: repo_admin
    app.dependency_overrides[admin_router.obter_admin_service] = lambda: AdminService(repo_admin)
    with TestClient(app) as c:
        yield c, repo_admin, token_admin, token_comum
    app.dependency_overrides.clear()


def test_listar_sem_sessao_401(ambiente) -> None:
    c, *_ = ambiente
    assert c.get("/admin/utilizadores").status_code == 401


def test_listar_papel_comum_403(ambiente) -> None:
    c, _, _, token_comum = ambiente
    c.cookies.set("access_token", token_comum)
    assert c.get("/admin/utilizadores").status_code == 403


def test_admin_lista_utilizadores(ambiente) -> None:
    c, _, token_admin, _ = ambiente
    c.cookies.set("access_token", token_admin)
    r = c.get("/admin/utilizadores")
    assert r.status_code == 200
    assert {u["email"] for u in r.json()} == {"id-admin@example.com", "rui@example.com"}


def test_promover_por_email(ambiente) -> None:
    c, repo, token_admin, _ = ambiente
    c.cookies.set("access_token", token_admin)
    r = c.post("/admin/utilizadores/promover", json={"email": "rui@example.com"})
    assert r.status_code == 200
    assert r.json()["papel"] == "admin"
    assert ("u-comum", "admin") in repo.definidos


def test_promover_email_desconhecido_404(ambiente) -> None:
    c, _, token_admin, _ = ambiente
    c.cookies.set("access_token", token_admin)
    r = c.post("/admin/utilizadores/promover", json={"email": "ninguem@example.com"})
    assert r.status_code == 404


def test_remover_admin_a_si_proprio_409(ambiente) -> None:
    c, _, token_admin, _ = ambiente
    c.cookies.set("access_token", token_admin)
    # promove primeiro o rui para haver mais do que um admin
    c.post("/admin/utilizadores/promover", json={"email": "rui@example.com"})
    r = c.post("/admin/utilizadores/id-admin/remover-admin")
    assert r.status_code == 409


def test_remover_ultimo_admin_409(ambiente) -> None:
    c, _, token_admin, _ = ambiente
    c.cookies.set("access_token", token_admin)
    r = c.post("/admin/utilizadores/id-admin/remover-admin")
    assert r.status_code == 409


def test_remover_admin_de_outra_conta(ambiente) -> None:
    c, _repo, token_admin, _ = ambiente
    c.cookies.set("access_token", token_admin)
    c.post("/admin/utilizadores/promover", json={"email": "rui@example.com"})
    r = c.post("/admin/utilizadores/u-comum/remover-admin")
    assert r.status_code == 200
    assert r.json()["papel"] == "comum"
