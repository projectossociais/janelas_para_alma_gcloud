from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.core.dependencies import obter_auth_service
from app.core.security import criar_access_token, hash_password
from app.main import app
from app.repositories.admin_stats_repository import EstatisticasRegisto, PendenciasRegisto
from app.repositories.utilizadores_repository import UtilizadorRegisto
from app.routers import admin as admin_router
from app.services.admin_service import AdminService
from app.services.auth_service import AuthService
from tests.services.test_admin_service import RepositorioAdminFalso, _u
from tests.services.test_auth_service import RepositorioFalso as RepositorioAuthFalso


class RepositorioStatsFalso:
    def __init__(self) -> None:
        self.dias_pedidos: list[int] = []

    def obter_estatisticas(self, desde, dias) -> EstatisticasRegisto:
        self.dias_pedidos.append(dias)
        return EstatisticasRegisto(
            total_utilizadores=42,
            novos_utilizadores=3,
            utilizadores_ativos_semana=7,
            sessoes_exercicio=15,
            analises_scanner=2,
            pedidos_premium=4,
            mensagens_contacto=5,
            serie=[],
        )

    def obter_pendencias(self) -> PendenciasRegisto:
        return PendenciasRegisto(
            pedidos_premium_pendentes=2,
            mensagens_por_ler=3,
            candidaturas_voluntariado_pendentes=1,
        )


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
    repo_stats = RepositorioStatsFalso()
    app.dependency_overrides[admin_router.obter_admin_stats_repository] = lambda: repo_stats
    with TestClient(app) as c:
        yield c, repo_admin, token_admin, token_comum, repo_stats
    app.dependency_overrides.clear()


def test_listar_sem_sessao_401(ambiente) -> None:
    c, *_ = ambiente
    assert c.get("/admin/utilizadores").status_code == 401


def test_listar_papel_comum_403(ambiente) -> None:
    c, _, _, token_comum, _ = ambiente
    c.cookies.set("access_token", token_comum)
    assert c.get("/admin/utilizadores").status_code == 403


def test_admin_lista_utilizadores(ambiente) -> None:
    c, _, token_admin, _, _ = ambiente
    c.cookies.set("access_token", token_admin)
    r = c.get("/admin/utilizadores")
    assert r.status_code == 200
    assert {u["email"] for u in r.json()} == {"id-admin@example.com", "rui@example.com"}


def test_promover_por_email(ambiente) -> None:
    c, repo, token_admin, _, _ = ambiente
    c.cookies.set("access_token", token_admin)
    r = c.post("/admin/utilizadores/promover", json={"email": "rui@example.com"})
    assert r.status_code == 200
    assert r.json()["papel"] == "admin"
    assert ("u-comum", "admin") in repo.definidos


def test_promover_email_desconhecido_404(ambiente) -> None:
    c, _, token_admin, _, _ = ambiente
    c.cookies.set("access_token", token_admin)
    r = c.post("/admin/utilizadores/promover", json={"email": "ninguem@example.com"})
    assert r.status_code == 404


def test_remover_admin_a_si_proprio_409(ambiente) -> None:
    c, _, token_admin, _, _ = ambiente
    c.cookies.set("access_token", token_admin)
    # promove primeiro o rui para haver mais do que um admin
    c.post("/admin/utilizadores/promover", json={"email": "rui@example.com"})
    r = c.post("/admin/utilizadores/id-admin/remover-admin")
    assert r.status_code == 409


def test_remover_ultimo_admin_409(ambiente) -> None:
    c, _, token_admin, _, _ = ambiente
    c.cookies.set("access_token", token_admin)
    r = c.post("/admin/utilizadores/id-admin/remover-admin")
    assert r.status_code == 409


def test_remover_admin_de_outra_conta(ambiente) -> None:
    c, _repo, token_admin, _, _ = ambiente
    c.cookies.set("access_token", token_admin)
    c.post("/admin/utilizadores/promover", json={"email": "rui@example.com"})
    r = c.post("/admin/utilizadores/u-comum/remover-admin")
    assert r.status_code == 200
    assert r.json()["papel"] == "comum"


def test_estatisticas_sem_sessao_401(ambiente) -> None:
    c, *_ = ambiente
    assert c.get("/admin/estatisticas").status_code == 401


def test_estatisticas_papel_comum_403(ambiente) -> None:
    c, _, _, token_comum, _ = ambiente
    c.cookies.set("access_token", token_comum)
    assert c.get("/admin/estatisticas").status_code == 403


def test_admin_ve_estatisticas(ambiente) -> None:
    c, _, token_admin, _, _ = ambiente
    c.cookies.set("access_token", token_admin)
    r = c.get("/admin/estatisticas")
    assert r.status_code == 200
    corpo = r.json()
    assert corpo["total_utilizadores"] == 42
    assert corpo["utilizadores_ativos_semana"] == 7


def test_estatisticas_limita_dias_absurdos(ambiente) -> None:
    c, _, token_admin, _, repo_stats = ambiente
    c.cookies.set("access_token", token_admin)
    c.get("/admin/estatisticas?dias=99999")
    assert repo_stats.dias_pedidos[-1] == 365
    c.get("/admin/estatisticas?dias=-5")
    assert repo_stats.dias_pedidos[-1] == 1


def test_pendencias_sem_sessao_401(ambiente) -> None:
    c, *_ = ambiente
    assert c.get("/admin/pendencias").status_code == 401


def test_admin_ve_pendencias(ambiente) -> None:
    c, _, token_admin, _, _ = ambiente
    c.cookies.set("access_token", token_admin)
    r = c.get("/admin/pendencias")
    assert r.status_code == 200
    corpo = r.json()
    assert corpo["pedidos_premium_pendentes"] == 2
    assert corpo["mensagens_por_ler"] == 3
    assert corpo["candidaturas_voluntariado_pendentes"] == 1


def test_definir_papel_sem_sessao_401(ambiente) -> None:
    c, *_ = ambiente
    assert c.post("/admin/utilizadores/u-comum/papel", json={"papel": "estrabico"}).status_code == 401


def test_admin_define_papel(ambiente) -> None:
    c, _repo, token_admin, _, _ = ambiente
    c.cookies.set("access_token", token_admin)
    r = c.post("/admin/utilizadores/u-comum/papel", json={"papel": "estrabico"})
    assert r.status_code == 200
    assert r.json()["papel"] == "estrabico"


def test_definir_papel_admin_e_422(ambiente) -> None:
    c, _, token_admin, _, _ = ambiente
    c.cookies.set("access_token", token_admin)
    r = c.post("/admin/utilizadores/u-comum/papel", json={"papel": "admin"})
    assert r.status_code == 422


def test_definir_papel_invalido_e_422(ambiente) -> None:
    c, _, token_admin, _, _ = ambiente
    c.cookies.set("access_token", token_admin)
    r = c.post("/admin/utilizadores/u-comum/papel", json={"papel": "super-utilizador"})
    assert r.status_code == 422


def test_definir_papel_de_um_admin_e_409(ambiente) -> None:
    c, _, token_admin, _, _ = ambiente
    c.cookies.set("access_token", token_admin)
    r = c.post("/admin/utilizadores/id-admin/papel", json={"papel": "comum"})
    assert r.status_code == 409


def test_definir_papel_utilizador_desconhecido_404(ambiente) -> None:
    c, _, token_admin, _, _ = ambiente
    c.cookies.set("access_token", token_admin)
    r = c.post("/admin/utilizadores/fantasma/papel", json={"papel": "comum"})
    assert r.status_code == 404
