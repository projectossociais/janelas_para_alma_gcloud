import pytest
from fastapi.testclient import TestClient

from app.core.dependencies import obter_auth_service
from app.main import app
from app.routers import jogo_local as jogo_local_router
from app.services.auth_service import AuthService
from app.services.jogo_local_service import MOEDAS_POR_ACERTO, RONDAS, JogoLocalService
from tests.routers.test_jogo_router import _seed
from tests.services.test_auth_service import RepositorioFalso as RepositorioAuthFalso
from tests.services.test_jogo_local_service import (
    RepositorioPartidasLocaisFalso,
    RepositorioPerguntasLocaisFalso,
)
from tests.services.test_jogo_service import RepositorioPerfisFalso


@pytest.fixture
def ambiente():
    repo_auth = RepositorioAuthFalso()
    perfis = RepositorioPerfisFalso()
    servico = JogoLocalService(RepositorioPerguntasLocaisFalso(), perfis, RepositorioPartidasLocaisFalso(perfis))
    token = _seed(repo_auth, "id-comum", "comum")
    token_outro = _seed(repo_auth, "id-outro", "comum")
    app.dependency_overrides[obter_auth_service] = lambda: AuthService(repo_auth)
    app.dependency_overrides[jogo_local_router.obter_jogo_local_service] = lambda: servico
    with TestClient(app) as c:
        yield c, token, token_outro, perfis
    app.dependency_overrides.clear()


def _abrir(c: TestClient, jogadores: int = 2) -> str:
    resposta = c.post("/jogo/local/partidas", json={"numero_jogadores": jogadores})
    assert resposta.status_code == 201
    return resposta.json()["id"]


@pytest.mark.parametrize(
    "caminho",
    [
        "/jogo/local/partidas",
        "/jogo/local/partidas/x/pergunta",
        "/jogo/local/partidas/x/responder",
        "/jogo/local/partidas/x/terminar",
    ],
)
def test_tudo_exige_sessao(ambiente, caminho) -> None:
    c, *_ = ambiente
    assert c.post(caminho, json={}).status_code == 401


@pytest.mark.parametrize("numero", [1, 3, 4, "muitos"])
def test_iniciar_com_numero_de_jogadores_invalido_devolve_422(ambiente, numero) -> None:
    c, token, *_ = ambiente
    c.cookies.set("access_token", token)
    assert c.post("/jogo/local/partidas", json={"numero_jogadores": numero}).status_code == 422


def test_iniciar_devolve_as_regras_do_premio(ambiente) -> None:
    c, token, *_ = ambiente
    c.cookies.set("access_token", token)
    resposta = c.post("/jogo/local/partidas", json={"numero_jogadores": 2})

    assert resposta.status_code == 201
    corpo = resposta.json()
    assert corpo["numero_jogadores"] == 2
    assert corpo["rondas"] == RONDAS
    assert corpo["moedas_por_acerto"] == MOEDAS_POR_ACERTO


def test_a_pergunta_nunca_traz_a_resposta_certa(ambiente) -> None:
    c, token, *_ = ambiente
    c.cookies.set("access_token", token)
    partida = _abrir(c)

    resposta = c.post(f"/jogo/local/partidas/{partida}/pergunta", json={"patamar": 2})

    assert resposta.status_code == 200
    assert set(resposta.json()) == {"id", "texto_pergunta", "opcao_a", "opcao_b", "opcao_c", "opcao_d"}


@pytest.mark.parametrize("patamar", [0, 16])
def test_pergunta_com_patamar_fora_de_1_a_15_devolve_422(ambiente, patamar) -> None:
    c, token, *_ = ambiente
    c.cookies.set("access_token", token)
    partida = _abrir(c)
    assert c.post(f"/jogo/local/partidas/{partida}/pergunta", json={"patamar": patamar}).status_code == 422


def test_responder_revela_a_certa_e_recusa_a_segunda_vez(ambiente) -> None:
    c, token, *_ = ambiente
    c.cookies.set("access_token", token)
    partida = _abrir(c)
    pergunta = c.post(f"/jogo/local/partidas/{partida}/pergunta", json={"patamar": 1}).json()
    corpo = {"pergunta_id": pergunta["id"], "resposta": "C"}

    primeira = c.post(f"/jogo/local/partidas/{partida}/responder", json=corpo)
    segunda = c.post(f"/jogo/local/partidas/{partida}/responder", json=corpo)

    assert primeira.status_code == 200
    assert primeira.json() == {"correta": False, "resposta_correta": "B", "explicacao": "porque sim"}
    assert segunda.status_code == 409


def test_responder_com_opcao_invalida_devolve_422(ambiente) -> None:
    c, token, *_ = ambiente
    c.cookies.set("access_token", token)
    partida = _abrir(c)
    pergunta = c.post(f"/jogo/local/partidas/{partida}/pergunta", json={"patamar": 1}).json()
    resposta = c.post(
        f"/jogo/local/partidas/{partida}/responder", json={"pergunta_id": pergunta["id"], "resposta": "E"}
    )
    assert resposta.status_code == 422


def test_responder_a_outra_pergunta_devolve_409(ambiente) -> None:
    c, token, *_ = ambiente
    c.cookies.set("access_token", token)
    partida = _abrir(c)
    c.post(f"/jogo/local/partidas/{partida}/pergunta", json={"patamar": 1})
    resposta = c.post(f"/jogo/local/partidas/{partida}/responder", json={"pergunta_id": "p3-9", "resposta": "B"})
    assert resposta.status_code == 409


def test_a_partida_de_outra_conta_devolve_404(ambiente) -> None:
    c, token, token_outro, _ = ambiente
    c.cookies.set("access_token", token)
    partida = _abrir(c)

    c.cookies.set("access_token", token_outro)
    assert c.post(f"/jogo/local/partidas/{partida}/pergunta", json={"patamar": 1}).status_code == 404
    assert c.post(f"/jogo/local/partidas/{partida}/terminar").status_code == 404


def test_partida_completa_paga_moedas_uma_so_vez(ambiente) -> None:
    c, token, _, perfis = ambiente
    c.cookies.set("access_token", token)
    partida = _abrir(c, 2)
    for i in range(2 * RONDAS):
        pergunta = c.post(f"/jogo/local/partidas/{partida}/pergunta", json={"patamar": 1}).json()
        # 6 certas, 3 erradas e um tempo esgotado.
        resposta = "B" if i < 6 else "A" if i < 9 else None
        c.post(f"/jogo/local/partidas/{partida}/responder", json={"pergunta_id": pergunta["id"], "resposta": resposta})

    primeira = c.post(f"/jogo/local/partidas/{partida}/terminar")
    segunda = c.post(f"/jogo/local/partidas/{partida}/terminar")

    assert primeira.status_code == 200
    assert primeira.json()["moedas_ganhas"] == 6 * MOEDAS_POR_ACERTO
    assert primeira.json()["limite_diario_atingido"] is False
    assert primeira.json()["perfil"]["moedas"] == 6 * MOEDAS_POR_ACERTO
    assert segunda.status_code == 409
    assert perfis.obter_ou_criar("id-comum").moedas == 6 * MOEDAS_POR_ACERTO
