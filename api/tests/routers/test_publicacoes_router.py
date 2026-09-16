"""Testes de integração de `/publicacoes` — o caso mais crítico é de
segurança: um rascunho nunca pode ser lido publicamente, mesmo sabendo o
slug exacto (só a listagem de admin o revela)."""

from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.core.dependencies import obter_auth_service
from app.core.security import criar_access_token, hash_password
from app.main import app
from app.repositories.utilizadores_repository import UtilizadorRegisto
from app.routers import publicacoes as publicacoes_router
from app.services.auth_service import AuthService
from app.services.publicacao_midia_service import PublicacaoMidiaService
from tests.services.test_auth_service import RepositorioFalso as RepositorioAuthFalso
from tests.services.test_publicacoes_service import RepositorioPublicacoesFalso
from tests.services.test_upload_service import PresignerFalso


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
    repo_pub = RepositorioPublicacoesFalso()
    presigner = PresignerFalso()
    token_admin = _seed(repo_auth, "id-admin", "admin")
    token_comum = _seed(repo_auth, "id-comum", "comum")
    app.dependency_overrides[obter_auth_service] = lambda: AuthService(repo_auth)
    app.dependency_overrides[publicacoes_router.obter_publicacoes_repository] = lambda: repo_pub
    app.dependency_overrides[publicacoes_router.obter_publicacao_midia_service] = (
        lambda: PublicacaoMidiaService(presigner, repo_pub)
    )
    with TestClient(app) as c:
        yield c, repo_pub, token_admin, token_comum
    app.dependency_overrides.clear()


def _criar(c: TestClient, token: str, titulo: str = "Rastreio em Luanda") -> dict:
    c.cookies.set("access_token", token)
    resposta = c.post("/publicacoes", json={"titulo": titulo, "resumo": "resumo", "corpo": "corpo"})
    assert resposta.status_code == 201
    return resposta.json()


# --- Leitura pública ---------------------------------------------------------


def test_listar_publicadas_comeca_vazia(ambiente) -> None:
    c, *_ = ambiente
    resposta = c.get("/publicacoes")
    assert resposta.status_code == 200
    assert resposta.json() == []


def test_rascunho_nao_aparece_na_listagem_publica(ambiente) -> None:
    c, _, token_admin, _ = ambiente
    _criar(c, token_admin)
    c.cookies.clear()
    assert c.get("/publicacoes").json() == []


def test_publicacao_publicada_aparece_na_listagem_publica(ambiente) -> None:
    c, _, token_admin, _ = ambiente
    criada = _criar(c, token_admin)
    c.post(f"/publicacoes/{criada['id']}/publicar")
    c.cookies.clear()

    resposta = c.get("/publicacoes")

    assert resposta.status_code == 200
    assert [p["slug"] for p in resposta.json()] == [criada["slug"]]


def test_slug_de_rascunho_devolve_404_mesmo_sabendo_o_slug_exacto(ambiente) -> None:
    c, _, token_admin, _ = ambiente
    criada = _criar(c, token_admin)
    c.cookies.clear()

    resposta = c.get(f"/publicacoes/{criada['slug']}")

    assert resposta.status_code == 404


def test_slug_inexistente_devolve_404(ambiente) -> None:
    c, *_ = ambiente
    assert c.get("/publicacoes/nao-existe").status_code == 404


def test_slug_de_publicacao_publicada_devolve_detalhe(ambiente) -> None:
    c, _, token_admin, _ = ambiente
    criada = _criar(c, token_admin)
    c.post(f"/publicacoes/{criada['id']}/publicar")
    c.cookies.clear()

    resposta = c.get(f"/publicacoes/{criada['slug']}")

    assert resposta.status_code == 200
    assert resposta.json()["titulo"] == "Rastreio em Luanda"


def test_despublicar_esconde_de_novo_da_leitura_publica(ambiente) -> None:
    c, _, token_admin, _ = ambiente
    criada = _criar(c, token_admin)
    c.post(f"/publicacoes/{criada['id']}/publicar")

    c.post(f"/publicacoes/{criada['id']}/despublicar")
    c.cookies.clear()

    assert c.get(f"/publicacoes/{criada['slug']}").status_code == 404


# --- Gestão exige admin ------------------------------------------------------


def test_listar_todas_sem_sessao_devolve_401(ambiente) -> None:
    c, *_ = ambiente
    assert c.get("/publicacoes/admin/todas").status_code == 401


def test_listar_todas_com_papel_comum_devolve_403(ambiente) -> None:
    c, _, _, token_comum = ambiente
    c.cookies.set("access_token", token_comum)
    assert c.get("/publicacoes/admin/todas").status_code == 403


def test_listar_todas_inclui_rascunhos(ambiente) -> None:
    c, _, token_admin, _ = ambiente
    _criar(c, token_admin)

    resposta = c.get("/publicacoes/admin/todas")

    assert resposta.status_code == 200
    assert len(resposta.json()) == 1
    assert resposta.json()[0]["estado"] == "rascunho"


def test_criar_sem_sessao_devolve_401(ambiente) -> None:
    c, *_ = ambiente
    resposta = c.post("/publicacoes", json={"titulo": "X", "resumo": "y", "corpo": "z"})
    assert resposta.status_code == 401


def test_criar_com_papel_comum_devolve_403(ambiente) -> None:
    c, _, _, token_comum = ambiente
    c.cookies.set("access_token", token_comum)
    resposta = c.post("/publicacoes", json={"titulo": "X", "resumo": "y", "corpo": "z"})
    assert resposta.status_code == 403


def test_criar_nasce_em_rascunho(ambiente) -> None:
    c, _, token_admin, _ = ambiente
    criada = _criar(c, token_admin)
    assert criada["estado"] == "rascunho"
    assert criada["slug"] == "rastreio-em-luanda"


def test_atualizar_publicacao_existente(ambiente) -> None:
    c, _, token_admin, _ = ambiente
    criada = _criar(c, token_admin)

    resposta = c.patch(f"/publicacoes/{criada['id']}", json={"titulo": "Novo Título"})

    assert resposta.status_code == 200
    assert resposta.json()["titulo"] == "Novo Título"
    assert resposta.json()["slug"] == criada["slug"]  # nunca muda


def test_atualizar_publicacao_inexistente_devolve_404(ambiente) -> None:
    c, _, token_admin, _ = ambiente
    c.cookies.set("access_token", token_admin)
    resposta = c.patch("/publicacoes/nao-existe", json={"titulo": "X"})
    assert resposta.status_code == 404


def test_publicar_inexistente_devolve_404(ambiente) -> None:
    c, _, token_admin, _ = ambiente
    c.cookies.set("access_token", token_admin)
    assert c.post("/publicacoes/nao-existe/publicar").status_code == 404


def test_apagar_publicacao(ambiente) -> None:
    c, _, token_admin, _ = ambiente
    criada = _criar(c, token_admin)

    resposta = c.request("DELETE", f"/publicacoes/{criada['id']}")

    assert resposta.status_code == 204
    assert c.get("/publicacoes/admin/todas").json() == []


def test_apagar_inexistente_devolve_404(ambiente) -> None:
    c, _, token_admin, _ = ambiente
    c.cookies.set("access_token", token_admin)
    assert c.request("DELETE", "/publicacoes/nao-existe").status_code == 404


# --- Fotos (capa + galeria) --------------------------------------------------


def test_preparar_capa_devolve_url_assinado_no_prefixo_da_publicacao(ambiente) -> None:
    c, _, token_admin, _ = ambiente
    criada = _criar(c, token_admin)

    resposta = c.post(f"/publicacoes/{criada['id']}/capa/preparar", json={"content_type": "image/png"})

    assert resposta.status_code == 200
    assert resposta.json()["chave"].startswith(f"publicacoes/{criada['id']}/")


def test_preparar_capa_recusa_tipo_invalido(ambiente) -> None:
    c, _, token_admin, _ = ambiente
    criada = _criar(c, token_admin)
    resposta = c.post(
        f"/publicacoes/{criada['id']}/capa/preparar", json={"content_type": "application/pdf"}
    )
    assert resposta.status_code == 422


def test_confirmar_capa_grava_url(ambiente) -> None:
    c, _, token_admin, _ = ambiente
    criada = _criar(c, token_admin)
    chave = f"publicacoes/{criada['id']}/capa.png"

    resposta = c.post(f"/publicacoes/{criada['id']}/capa/confirmar", json={"chave": chave})

    assert resposta.status_code == 200
    assert resposta.json()["capa_url"].endswith(chave)


def test_confirmar_capa_recusa_chave_de_outra_publicacao(ambiente) -> None:
    c, _, token_admin, _ = ambiente
    criada = _criar(c, token_admin)

    resposta = c.post(
        f"/publicacoes/{criada['id']}/capa/confirmar", json={"chave": "publicacoes/outra-pub/capa.png"}
    )

    assert resposta.status_code == 403


def test_confirmar_midia_adiciona_a_galeria(ambiente) -> None:
    c, _, token_admin, _ = ambiente
    criada = _criar(c, token_admin)
    chave = f"publicacoes/{criada['id']}/foto1.jpg"

    resposta = c.post(f"/publicacoes/{criada['id']}/midias/confirmar", json={"chave": chave})

    assert resposta.status_code == 201
    assert resposta.json()["url"].endswith(chave)


def test_confirmar_midia_recusa_chave_de_outra_publicacao(ambiente) -> None:
    c, _, token_admin, _ = ambiente
    criada = _criar(c, token_admin)

    resposta = c.post(
        f"/publicacoes/{criada['id']}/midias/confirmar", json={"chave": "publicacoes/outra-pub/foto.jpg"}
    )

    assert resposta.status_code == 403


def test_remover_midia(ambiente) -> None:
    c, _, token_admin, _ = ambiente
    criada = _criar(c, token_admin)
    chave = f"publicacoes/{criada['id']}/foto1.jpg"
    midia = c.post(f"/publicacoes/{criada['id']}/midias/confirmar", json={"chave": chave}).json()

    resposta = c.request("DELETE", f"/publicacoes/{criada['id']}/midias/{midia['id']}")

    assert resposta.status_code == 204


def test_rotas_de_midia_exigem_admin(ambiente) -> None:
    c, _, token_admin, token_comum = ambiente
    criada = _criar(c, token_admin)
    c.cookies.set("access_token", token_comum)

    resposta = c.post(f"/publicacoes/{criada['id']}/capa/preparar", json={"content_type": "image/png"})

    assert resposta.status_code == 403
