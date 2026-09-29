from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.core.dependencies import obter_utilizador_atual
from app.main import app
from app.repositories.utilizadores_repository import UtilizadorRegisto
from app.routers.relatorios import obter_partilha_relatorio_service
from app.services.partilha_relatorio_service import PartilhaRelatorioService
from tests.services.test_partilha_relatorio_service import RepositorioPartilhasFalso, SessoesFalsas


def _utilizador(id_: str) -> UtilizadorRegisto:
    return UtilizadorRegisto(
        id=id_, email=f"{id_}@example.com", password_hash="x", papel="comum",
        nome_completo=None, provincia=None, genero=None, criado_em=datetime.now(UTC),
    )


@pytest.fixture
def ambiente():
    repo, sessoes = RepositorioPartilhasFalso(), SessoesFalsas()
    app.dependency_overrides[obter_partilha_relatorio_service] = lambda: PartilhaRelatorioService(repo, sessoes)
    with TestClient(app) as c:
        yield c, repo
    app.dependency_overrides.clear()


def _como(id_: str) -> None:
    app.dependency_overrides[obter_utilizador_atual] = lambda: _utilizador(id_)


def test_criar_listar_e_revogar_exigem_sessao(ambiente) -> None:
    c, _ = ambiente
    assert c.post("/relatorios/partilhas").status_code == 401
    assert c.get("/relatorios/partilhas").status_code == 401
    assert c.delete("/relatorios/partilhas/p1").status_code == 401


def test_criar_devolve_o_token_uma_vez_e_a_lista_nunca_o_mostra(ambiente) -> None:
    c, _ = ambiente
    _como("u1")
    criada = c.post("/relatorios/partilhas")
    assert criada.status_code == 201
    corpo = criada.json()
    assert corpo["token"] and corpo["activa"] is True
    lista = c.get("/relatorios/partilhas").json()
    assert len(lista) == 1 and "token" not in lista[0]


def test_sexto_link_activo_da_409(ambiente) -> None:
    c, _ = ambiente
    _como("u1")
    for _ in range(5):
        assert c.post("/relatorios/partilhas").status_code == 201
    assert c.post("/relatorios/partilhas").status_code == 409


def test_o_medico_abre_o_link_sem_sessao_e_sem_cache(ambiente) -> None:
    c, _ = ambiente
    _como("u1")
    token = c.post("/relatorios/partilhas").json()["token"]
    app.dependency_overrides.pop(obter_utilizador_atual)
    r = c.get(f"/relatorios/partilhados/{token}")
    assert r.status_code == 200
    assert r.headers["cache-control"] == "no-store"
    assert "noindex" in r.headers["x-robots-tag"]
    corpo = r.json()
    assert corpo["nome"] == "Ana" and corpo["olho_mais_fraco"] == "esquerdo"
    assert "user_id" not in corpo["sessoes"][0] and "id" not in corpo["sessoes"][0]


def test_link_revogado_ou_inventado_da_404(ambiente) -> None:
    c, _ = ambiente
    _como("u1")
    criada = c.post("/relatorios/partilhas").json()
    assert c.delete(f"/relatorios/partilhas/{criada['id']}").status_code == 204
    assert c.get(f"/relatorios/partilhados/{criada['token']}").status_code == 404
    assert c.get("/relatorios/partilhados/inventado").status_code == 404


def test_ninguem_revoga_o_link_de_outra_pessoa(ambiente) -> None:
    c, _ = ambiente
    _como("u1")
    criada = c.post("/relatorios/partilhas").json()
    _como("u2")
    assert c.delete(f"/relatorios/partilhas/{criada['id']}").status_code == 404
    app.dependency_overrides.pop(obter_utilizador_atual)
    assert c.get(f"/relatorios/partilhados/{criada['token']}").status_code == 200
