"""`GET /admin/comprovativos/{origem}/{id}` — só um admin recebe o URL de
leitura de um comprovativo bancário (nome e conta de quem pagou)."""

from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.core.dependencies import obter_auth_service
from app.core.security import criar_access_token, hash_password
from app.main import app
from app.repositories.utilizadores_repository import UtilizadorRegisto
from app.routers import comprovativos as comprovativos_router
from app.services.auth_service import AuthService
from app.services.comprovativo_leitura_service import (
    ComprovativoLeituraService,
    ReferenciaComprovativo,
)
from tests.services.test_auth_service import RepositorioFalso as RepositorioAuthFalso
from tests.services.test_comprovativo_leitura_service import LeitorFalso, RepositorioFalso


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


REFERENCIAS = {
    ("premium", "p1"): ReferenciaComprovativo(chave="comprovativos/a.pdf", url_legado=None),
    ("doacao", "d1"): ReferenciaComprovativo(chave=None, url_legado="https://pub.r2.dev/comprovativos/b.pdf"),
    ("loja", "l1"): ReferenciaComprovativo(chave="comprovativos/c.png", url_legado=None),
    ("doacao", "sem"): ReferenciaComprovativo(chave=None, url_legado=None),
}


@pytest.fixture
def ambiente():
    repo_auth = RepositorioAuthFalso()
    tokens = {
        "admin": _seed(repo_auth, "id-admin", "admin"),
        "comum": _seed(repo_auth, "id-comum", "comum"),
        "clinica": _seed(repo_auth, "id-clinica", "clinica"),
    }
    leitor = LeitorFalso()
    estado = {"leitor": leitor}
    app.dependency_overrides[obter_auth_service] = lambda: AuthService(repo_auth)
    app.dependency_overrides[comprovativos_router.obter_comprovativo_leitura_service] = (
        lambda: ComprovativoLeituraService(RepositorioFalso(REFERENCIAS), estado["leitor"], 300)
    )
    with TestClient(app) as c:
        yield c, tokens, estado
    app.dependency_overrides.clear()


def test_sem_sessao_devolve_401(ambiente) -> None:
    c, *_ = ambiente
    assert c.get("/admin/comprovativos/premium/p1").status_code == 401


@pytest.mark.parametrize("papel", ["comum", "clinica"])
def test_quem_nao_e_admin_recebe_403_e_nenhum_url(ambiente, papel) -> None:
    c, tokens, estado = ambiente
    c.cookies.set("access_token", tokens[papel])

    resposta = c.get("/admin/comprovativos/premium/p1")

    assert resposta.status_code == 403
    assert "url" not in resposta.json()
    assert estado["leitor"].chamadas == []


def test_admin_recebe_url_assinado_de_vida_curta(ambiente) -> None:
    c, tokens, _ = ambiente
    c.cookies.set("access_token", tokens["admin"])

    resposta = c.get("/admin/comprovativos/premium/p1")

    assert resposta.status_code == 200
    assert resposta.json() == {
        "url": "https://privado.r2.test/comprovativos/a.pdf?assinatura=xyz",
        "expira_em_segundos": 300,
    }
    assert resposta.headers["cache-control"] == "no-store"


def test_admin_abre_comprovativo_da_loja(ambiente) -> None:
    c, tokens, _ = ambiente
    c.cookies.set("access_token", tokens["admin"])

    assert c.get("/admin/comprovativos/loja/l1").json()["url"].endswith("comprovativos/c.png?assinatura=xyz")


def test_admin_continua_a_abrir_um_comprovativo_antigo_por_migrar(ambiente) -> None:
    c, tokens, _ = ambiente
    c.cookies.set("access_token", tokens["admin"])

    resposta = c.get("/admin/comprovativos/doacao/d1")

    assert resposta.status_code == 200
    assert resposta.json() == {"url": "https://pub.r2.dev/comprovativos/b.pdf", "expira_em_segundos": None}


def test_registo_inexistente_ou_sem_comprovativo_devolve_404(ambiente) -> None:
    c, tokens, _ = ambiente
    c.cookies.set("access_token", tokens["admin"])

    assert c.get("/admin/comprovativos/premium/nao-existe").status_code == 404
    assert c.get("/admin/comprovativos/doacao/sem").status_code == 404


def test_origem_desconhecida_devolve_422(ambiente) -> None:
    c, tokens, _ = ambiente
    c.cookies.set("access_token", tokens["admin"])

    assert c.get("/admin/comprovativos/avatares/p1").status_code == 422


def test_sem_bucket_privado_configurado_devolve_503(ambiente) -> None:
    c, tokens, estado = ambiente
    estado["leitor"] = None
    c.cookies.set("access_token", tokens["admin"])

    assert c.get("/admin/comprovativos/premium/p1").status_code == 503
