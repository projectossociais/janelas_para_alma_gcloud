"""`GET /admin/comprovativos-manuais/url` -- só admins abrem comprovativos
(plano anual, doações, loja); chave privada → URL assinado, URL público
antigo → o mesmo URL, tudo o resto → 422."""

from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.core.config import obter_settings
from app.core.dependencies import obter_auth_service
from app.core.security import criar_access_token, hash_password
from app.main import app
from app.repositories.utilizadores_repository import UtilizadorRegisto
from app.routers import admin as admin_router
from app.services.auth_service import AuthService
from tests.services.test_auth_service import RepositorioFalso as RepositorioAuthFalso

BASE_PUBLICA = "https://cdn.exemplo.test"


class LeitorFalso:
    def url_de_leitura(self, chave: str) -> str:
        return f"https://r2.privado.test/{chave}?assinado=1"


def _seed(repo: RepositorioAuthFalso, id_: str, papel: str) -> str:
    repo._utilizadores[f"{id_}@example.com"] = UtilizadorRegisto(
        id=id_, email=f"{id_}@example.com", password_hash=hash_password("password-forte-123"),
        papel=papel, nome_completo=None, provincia=None, genero=None, criado_em=datetime.now(UTC),
    )
    return criar_access_token(id_)


@pytest.fixture
def ambiente(monkeypatch):
    monkeypatch.setattr(obter_settings(), "r2_public_base_url", BASE_PUBLICA)
    repo = RepositorioAuthFalso()
    tokens = {"admin": _seed(repo, "id-admin", "admin"), "comum": _seed(repo, "id-comum", "comum")}
    app.dependency_overrides[obter_auth_service] = lambda: AuthService(repo)
    app.dependency_overrides[admin_router.obter_leitor_comprovativos] = lambda: LeitorFalso()
    with TestClient(app) as c:
        yield c, tokens
    app.dependency_overrides.clear()


def _pedir(c, referencia):
    return c.get("/admin/comprovativos-manuais/url", params={"referencia": referencia})


def test_so_admins(ambiente) -> None:
    c, tokens = ambiente
    assert _pedir(c, "comprovativos/a.pdf").status_code == 401
    c.cookies.set("access_token", tokens["comum"])
    assert _pedir(c, "comprovativos/a.pdf").status_code == 403


def test_chave_privada_e_url_antigo(ambiente) -> None:
    c, tokens = ambiente
    c.cookies.set("access_token", tokens["admin"])
    assert _pedir(c, "comprovativos/a.pdf").json() == {"url": "https://r2.privado.test/comprovativos/a.pdf?assinado=1"}
    antigo = f"{BASE_PUBLICA}/comprovativos/antigo.png"
    assert _pedir(c, antigo).json() == {"url": antigo}


@pytest.mark.parametrize("referencia", ["avatares/u/x.png", "https://malicioso.test/comprovativos/x.pdf"])
def test_recusa_o_que_nao_e_comprovativo(ambiente, referencia) -> None:
    c, tokens = ambiente
    c.cookies.set("access_token", tokens["admin"])
    assert _pedir(c, referencia).status_code == 422


def test_sem_bucket_privado_so_abre_urls_antigos(ambiente) -> None:
    c, tokens = ambiente
    app.dependency_overrides[admin_router.obter_leitor_comprovativos] = lambda: None
    c.cookies.set("access_token", tokens["admin"])
    assert _pedir(c, "comprovativos/a.pdf").status_code == 503
    assert _pedir(c, f"{BASE_PUBLICA}/comprovativos/antigo.png").status_code == 200
