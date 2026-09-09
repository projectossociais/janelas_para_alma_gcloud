"""Testes da dependency `obter_utilizador_admin`.

É a única implementação da verificação de papel de administrador no sistema
(CLAUDE.md, "has_role deve ter uma única implementação"). Os três caminhos
que importam: sem sessão (401), sessão de papel comum (403), sessão de
admin (200). Testa-se contra uma rota descartável montada só para o teste —
ainda não há router de admin real; quando houver, herda esta garantia sem a
repetir.
"""

from datetime import UTC, datetime

import pytest
from fastapi import Depends
from fastapi.testclient import TestClient

from app.core.dependencies import obter_auth_service, obter_utilizador_admin
from app.core.security import criar_access_token, hash_password
from app.main import app
from app.repositories.utilizadores_repository import UtilizadorRegisto
from app.services.auth_service import AuthService
from tests.services.test_auth_service import RepositorioFalso

ROTA = "/_teste/so-admin"


@app.get(ROTA)
def _rota_so_admin(_: UtilizadorRegisto = Depends(obter_utilizador_admin)) -> dict[str, str]:
    return {"ok": "sim"}


def _utilizador(id_: str, papel: str) -> UtilizadorRegisto:
    return UtilizadorRegisto(
        id=id_,
        email=f"{id_}@example.com",
        password_hash=hash_password("password-forte-123"),
        papel=papel,
        nome_completo=None,
        provincia=None,
        genero=None,
        criado_em=datetime.now(UTC),
    )


@pytest.fixture
def client():
    repo = RepositorioFalso()
    repo._utilizadores["admin@example.com"] = _utilizador("id-admin", "admin")
    repo._utilizadores["comum@example.com"] = _utilizador("id-comum", "comum")

    app.dependency_overrides[obter_auth_service] = lambda: AuthService(repo)
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_sem_sessao_devolve_401(client: TestClient) -> None:
    assert client.get(ROTA).status_code == 401


def test_sessao_de_papel_comum_devolve_403(client: TestClient) -> None:
    client.cookies.set("access_token", criar_access_token("id-comum"))
    resposta = client.get(ROTA)
    assert resposta.status_code == 403
    assert "administrador" in resposta.json()["detail"]


def test_sessao_de_admin_passa(client: TestClient) -> None:
    client.cookies.set("access_token", criar_access_token("id-admin"))
    resposta = client.get(ROTA)
    assert resposta.status_code == 200
    assert resposta.json() == {"ok": "sim"}
