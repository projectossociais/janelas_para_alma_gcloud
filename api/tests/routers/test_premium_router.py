from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.core.dependencies import obter_auth_service
from app.core.security import criar_access_token, hash_password
from app.main import app
from app.repositories.premium_repository import PedidoPremiumRegisto
from app.repositories.utilizadores_repository import UtilizadorRegisto
from app.routers import premium as premium_router
from app.services.auth_service import AuthService
from app.services.premium_service import PremiumService
from tests.services.test_auth_service import RepositorioFalso as RepositorioAuthFalso


class RepositorioPremiumFalso:
    def __init__(self) -> None:
        self._pedidos: dict[str, PedidoPremiumRegisto] = {}
        self._seq = 0

    def criar(self, nome, email, telefone, plano, user_id) -> PedidoPremiumRegisto:
        self._seq += 1
        reg = PedidoPremiumRegisto(
            id=f"ped-{self._seq}",
            user_id=user_id,
            nome=nome,
            email=email,
            telefone=telefone,
            plano=plano,
            status="pendente",
            aprovado_por=None,
            aprovado_em=None,
            created_at=datetime.now(UTC),
        )
        self._pedidos[reg.id] = reg
        return reg

    def obter(self, pedido_id) -> PedidoPremiumRegisto | None:
        return self._pedidos.get(pedido_id)

    def listar(self) -> list[PedidoPremiumRegisto]:
        return list(self._pedidos.values())

    def aprovar_pagamento(self, pedido_id, admin_id, quando, expira_em) -> PedidoPremiumRegisto:
        p = self._pedidos[pedido_id]
        novo = PedidoPremiumRegisto(
            **{**p.__dict__, "status": "aprovado", "aprovado_por": admin_id, "aprovado_em": quando}
        )
        self._pedidos[pedido_id] = novo
        return novo

    def revogar(self, pedido_id, admin_id, quando) -> PedidoPremiumRegisto:
        p = self._pedidos[pedido_id]
        novo = PedidoPremiumRegisto(
            **{**p.__dict__, "status": "revogado", "aprovado_por": admin_id, "aprovado_em": quando}
        )
        self._pedidos[pedido_id] = novo
        return novo


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
    repo_premium = RepositorioPremiumFalso()
    token_admin = _seed(repo_auth, "id-admin", "admin")
    token_comum = _seed(repo_auth, "id-comum", "comum")
    app.dependency_overrides[obter_auth_service] = lambda: AuthService(repo_auth)
    app.dependency_overrides[premium_router.obter_premium_repository] = lambda: repo_premium
    app.dependency_overrides[premium_router.obter_premium_service] = lambda: PremiumService(repo_premium)
    with TestClient(app) as c:
        yield c, repo_premium, token_admin, token_comum
    app.dependency_overrides.clear()


# --- criar pedido (público) ------------------------------------------------


def test_criar_pedido_sem_sessao_e_publico(ambiente) -> None:
    c, repo, *_ = ambiente
    r = c.post("/premium-requests", json={"nome": "Ana", "email": "ana@example.com", "plano": "mensal"})
    assert r.status_code == 201
    assert r.json()["status"] == "pendente"
    assert repo.listar()[0].user_id is None


def test_criar_pedido_com_sessao_liga_a_conta(ambiente) -> None:
    c, repo, _, token_comum = ambiente
    c.cookies.set("access_token", token_comum)
    c.post("/premium-requests", json={"nome": "Rui", "email": "rui@example.com"})
    assert repo.listar()[0].user_id == "id-comum"


# --- listar / aprovar exigem admin --------------------------------------


def test_listar_sem_sessao_401(ambiente) -> None:
    c, *_ = ambiente
    assert c.get("/premium-requests").status_code == 401


def test_listar_papel_comum_403(ambiente) -> None:
    c, _, _, token_comum = ambiente
    c.cookies.set("access_token", token_comum)
    assert c.get("/premium-requests").status_code == 403


def test_admin_aprova_pagamento(ambiente) -> None:
    c, repo, token_admin, _ = ambiente
    ped = repo.criar("Ana", "ana@example.com", None, "mensal", "id-comum")
    c.cookies.set("access_token", token_admin)

    r = c.post(f"/premium-requests/{ped.id}/aprovar")

    assert r.status_code == 200
    corpo = r.json()
    assert corpo["status"] == "aprovado"
    assert corpo["aprovado_por"] == "id-admin"
    assert corpo["aprovado_em"] is not None


def test_aprovar_inexistente_404(ambiente) -> None:
    c, _, token_admin, _ = ambiente
    c.cookies.set("access_token", token_admin)
    assert c.post("/premium-requests/ped-999/aprovar").status_code == 404


def test_aprovar_duas_vezes_409(ambiente) -> None:
    c, repo, token_admin, _ = ambiente
    ped = repo.criar("Ana", "ana@example.com", None, None, "id-comum")
    c.cookies.set("access_token", token_admin)
    c.post(f"/premium-requests/{ped.id}/aprovar")
    assert c.post(f"/premium-requests/{ped.id}/aprovar").status_code == 409


def test_aprovar_pedido_sem_conta_422(ambiente) -> None:
    c, repo, token_admin, _ = ambiente
    ped = repo.criar("Anon", "anon@example.com", None, None, None)
    c.cookies.set("access_token", token_admin)
    assert c.post(f"/premium-requests/{ped.id}/aprovar").status_code == 422


def test_admin_revoga(ambiente) -> None:
    c, repo, token_admin, _ = ambiente
    ped = repo.criar("Ana", "ana@example.com", None, None, "id-comum")
    c.cookies.set("access_token", token_admin)
    c.post(f"/premium-requests/{ped.id}/aprovar")

    r = c.post(f"/premium-requests/{ped.id}/revogar")
    assert r.status_code == 200
    assert r.json()["status"] == "revogado"


def test_revogar_inexistente_404(ambiente) -> None:
    c, _, token_admin, _ = ambiente
    c.cookies.set("access_token", token_admin)
    assert c.post("/premium-requests/ped-999/revogar").status_code == 404
