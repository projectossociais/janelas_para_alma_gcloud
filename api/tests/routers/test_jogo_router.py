from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.core.dependencies import obter_auth_service
from app.core.security import criar_access_token, hash_password
from app.main import app
from app.repositories.jogo_repository import PerguntaJogoRegisto
from app.repositories.utilizadores_repository import UtilizadorRegisto
from app.routers import jogo as jogo_router
from app.services.auth_service import AuthService
from app.services.loja_jogo_service import PACOTES_DIAMANTES, LojaJogoService
from app.services.mercado_jogo_service import VENDEDORES, MercadoJogoService
from tests.services.test_auth_service import RepositorioFalso as RepositorioAuthFalso
from tests.services.test_jogo_service import (
    RepositorioPartidasFalso,
)
from tests.services.test_jogo_service import (
    RepositorioPerfisFalso as RepositorioPerfilJogadorFalso,
)
from tests.services.test_mercado_jogo_service import RepositorioMercadoFalso


class RepositorioPerguntaJogoFalso:
    """Mesmo contrato (Protocol) que o repositório real, em memória."""

    def __init__(self) -> None:
        self._perguntas: list[PerguntaJogoRegisto] = []
        self._proximo = 1

    def obter_aleatoria(
        self, nivel_dificuldade: int | None = None, excluir_id: str | None = None
    ) -> PerguntaJogoRegisto | None:
        candidatas = [p for p in self._perguntas if p.id != excluir_id]
        if nivel_dificuldade is not None:
            candidatas = [p for p in candidatas if p.nivel_dificuldade == nivel_dificuldade]
        return candidatas[0] if candidatas else None

    def obter_por_id(self, pergunta_id: str) -> PerguntaJogoRegisto | None:
        return next((p for p in self._perguntas if p.id == pergunta_id), None)

    def criar(
        self,
        texto_pergunta: str,
        opcao_a: str,
        opcao_b: str,
        opcao_c: str,
        opcao_d: str,
        resposta_correta: str,
        nivel_dificuldade: int,
        explicacao: str | None,
    ) -> PerguntaJogoRegisto:
        registo = PerguntaJogoRegisto(
            id=f"pergunta-{self._proximo}",
            texto_pergunta=texto_pergunta,
            opcao_a=opcao_a,
            opcao_b=opcao_b,
            opcao_c=opcao_c,
            opcao_d=opcao_d,
            resposta_correta=resposta_correta,
            nivel_dificuldade=nivel_dificuldade,
            explicacao=explicacao,
        )
        self._proximo += 1
        self._perguntas.append(registo)
        return registo


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
def repo_perfil() -> RepositorioPerfilJogadorFalso:
    return RepositorioPerfilJogadorFalso()


@pytest.fixture
def repo_partidas(repo_perfil) -> RepositorioPartidasFalso:
    return RepositorioPartidasFalso(repo_perfil)


@pytest.fixture
def ambiente(repo_perfil, repo_partidas):
    repo_auth = RepositorioAuthFalso()
    repo_jogo = RepositorioPerguntaJogoFalso()
    token_admin = _seed(repo_auth, "id-admin", "admin")
    token_comum = _seed(repo_auth, "id-comum", "comum")
    app.dependency_overrides[obter_auth_service] = lambda: AuthService(repo_auth)
    app.dependency_overrides[jogo_router.obter_pergunta_jogo_repository] = lambda: repo_jogo
    app.dependency_overrides[jogo_router.obter_perfil_jogador_repository] = lambda: repo_perfil
    app.dependency_overrides[jogo_router.obter_partida_jogo_repository] = lambda: repo_partidas
    with TestClient(app) as c:
        yield c, repo_jogo, token_admin, token_comum, repo_perfil
    app.dependency_overrides.clear()


# --- Gestão exige admin ------------------------------------------------------

_PERGUNTA_VALIDA = {
    "texto_pergunta": "2+2?",
    "opcao_a": "1",
    "opcao_b": "2",
    "opcao_c": "3",
    "opcao_d": "4",
    "resposta_correta": "D",
    "nivel_dificuldade": 1,
}


def test_criar_pergunta_sem_sessao_devolve_401(ambiente) -> None:
    c, *_ = ambiente
    resposta = c.post("/admin/jogo/perguntas", json=_PERGUNTA_VALIDA)
    assert resposta.status_code == 401


def test_criar_pergunta_com_papel_comum_devolve_403(ambiente) -> None:
    c, _, _, token_comum, _ = ambiente
    c.cookies.set("access_token", token_comum)
    resposta = c.post("/admin/jogo/perguntas", json=_PERGUNTA_VALIDA)
    assert resposta.status_code == 403


def test_admin_cria_pergunta(ambiente) -> None:
    c, repo, token_admin, *_ = ambiente
    c.cookies.set("access_token", token_admin)
    resposta = c.post(
        "/admin/jogo/perguntas",
        json={**_PERGUNTA_VALIDA, "explicacao": "porque sim"},
    )
    assert resposta.status_code == 201
    corpo = resposta.json()
    assert corpo["resposta_correta"] == "D"
    assert corpo["nivel_dificuldade"] == 1
    assert corpo["explicacao"] == "porque sim"
    assert repo.obter_por_id(corpo["id"]) is not None


def test_criar_pergunta_com_nivel_fora_do_intervalo_devolve_422(ambiente) -> None:
    c, _, token_admin, *_ = ambiente
    c.cookies.set("access_token", token_admin)
    resposta = c.post("/admin/jogo/perguntas", json={**_PERGUNTA_VALIDA, "nivel_dificuldade": 4})
    assert resposta.status_code == 422


def test_criar_pergunta_com_resposta_correta_invalida_devolve_422(ambiente) -> None:
    c, _, token_admin, *_ = ambiente
    c.cookies.set("access_token", token_admin)
    resposta = c.post("/admin/jogo/perguntas", json={**_PERGUNTA_VALIDA, "resposta_correta": "Z"})
    assert resposta.status_code == 422


# --- Perfil e economia (exige sessão) ----------------------------------------


def test_obter_perfil_sem_sessao_devolve_401(ambiente) -> None:
    c, *_ = ambiente
    assert c.get("/jogo/perfil").status_code == 401


def test_obter_perfil_cria_um_perfil_zerado_na_primeira_vez(ambiente) -> None:
    c, _, _, token_comum, _ = ambiente
    c.cookies.set("access_token", token_comum)

    resposta = c.get("/jogo/perfil")
    assert resposta.status_code == 200
    assert resposta.json() == {
        "moedas": 0,
        "diamantes": 0,
        "partidas_jogadas": 0,
        "patamar_maximo_alcancado": 0,
        "melhor_sequencia": 0,
    }


# --- Loja de diamantes -------------------------------------------------------


@pytest.fixture
def loja_simulada(ambiente):
    c, _repo, _admin, token_comum, repo_perfil = ambiente
    app.dependency_overrides[jogo_router.obter_loja_jogo_service] = lambda: LojaJogoService(
        repo_perfil, pagamentos_simulados=True
    )
    return c, token_comum, repo_perfil


@pytest.fixture
def loja_sem_pagamentos(ambiente):
    c, _repo, _admin, token_comum, repo_perfil = ambiente
    app.dependency_overrides[jogo_router.obter_loja_jogo_service] = lambda: LojaJogoService(
        repo_perfil, pagamentos_simulados=False
    )
    return c, token_comum, repo_perfil


def test_listar_pacotes_e_publico_e_vem_do_catalogo_do_servidor(loja_sem_pagamentos) -> None:
    c, *_ = loja_sem_pagamentos
    resposta = c.get("/jogo/loja/pacotes")
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["pagamento_simulado"] is False
    assert [p["id"] for p in corpo["pacotes"]] == [p.id for p in PACOTES_DIAMANTES]
    assert all(p["total_diamantes"] == p["diamantes"] + p["bonus"] for p in corpo["pacotes"])


def test_comprar_sem_sessao_devolve_401(loja_simulada) -> None:
    c, *_ = loja_simulada
    assert c.post("/jogo/loja/compras", json={"pacote_id": "pequeno"}).status_code == 401


def test_comprar_em_modo_simulado_credita_diamantes(loja_simulada) -> None:
    c, token, repo_perfil = loja_simulada
    c.cookies.set("access_token", token)
    resposta = c.post(
        "/jogo/loja/compras", json={"pacote_id": "pequeno"}
    )
    assert resposta.status_code == 200
    assert resposta.json()["diamantes"] == PACOTES_DIAMANTES[0].total_diamantes
    assert repo_perfil.obter_ou_criar("id-comum").diamantes == PACOTES_DIAMANTES[0].total_diamantes


def test_comprar_ignora_quantidade_enviada_pelo_cliente(loja_simulada) -> None:
    # Um pedido forjado a mandar "diamantes" no corpo não muda nada -- o
    # servidor só lê o pacote_id e credita o que está no catálogo.
    c, token, _ = loja_simulada
    c.cookies.set("access_token", token)
    resposta = c.post(
        "/jogo/loja/compras",
        json={"pacote_id": "pequeno", "diamantes": 999999},
    )
    assert resposta.status_code == 200
    assert resposta.json()["diamantes"] == PACOTES_DIAMANTES[0].total_diamantes


def test_comprar_pacote_inexistente_devolve_404(loja_simulada) -> None:
    c, token, _ = loja_simulada
    c.cookies.set("access_token", token)
    resposta = c.post("/jogo/loja/compras", json={"pacote_id": "nao-existe"})
    assert resposta.status_code == 404


def test_comprar_sem_pagamentos_simulados_devolve_503_sem_creditar(loja_sem_pagamentos) -> None:
    c, token, repo_perfil = loja_sem_pagamentos
    c.cookies.set("access_token", token)
    resposta = c.post("/jogo/loja/compras", json={"pacote_id": "grande"})
    assert resposta.status_code == 503
    assert repo_perfil.obter_ou_criar("id-comum").diamantes == 0



def _entrar(ambiente) -> None:
    c, _repo, _admin, token, _ = ambiente
    c.cookies.set("access_token", token)


def _pergunta(c) -> dict:
    resposta = c.post("/jogo/partidas/atual/pergunta")
    assert resposta.status_code == 200, resposta.text
    return resposta.json()


def _responder(c, resposta_usuario: str = "C") -> dict:
    pergunta = _pergunta(c)
    resposta = c.post("/jogo/validar", json={"pergunta_id": pergunta["id"], "resposta_usuario": resposta_usuario})
    assert resposta.status_code == 200, resposta.text
    return {"pergunta": pergunta, "corpo": resposta.json()}


@pytest.fixture
def banco(ambiente):
    """Uma pergunta por nível, certa "C" -- chega para subir a escada toda."""
    _c, repo, *_ = ambiente
    for nivel in (1, 2, 3):
        repo.criar(f"nível {nivel}?", "a", "b", "c", "d", "C", nivel, f"explicação {nivel}")
    return repo


# --- Tudo exige sessão -------------------------------------------------------


@pytest.mark.parametrize(
    ("metodo", "rota"),
    [
        ("post", "/jogo/partidas"),
        ("post", "/jogo/partidas/atual/pergunta"),
        ("post", "/jogo/validar"),
        ("post", "/jogo/tempo-esgotado"),
        ("post", "/jogo/ajudas/cinquenta-cinquenta"),
        ("post", "/jogo/ajudas/opiniao-publico"),
        ("post", "/jogo/partidas/atual/vida-extra"),
        ("post", "/jogo/partidas/atual/terminar"),
        ("post", "/jogo/recompensas"),
    ],
)
def test_rotas_do_jogo_exigem_sessao(ambiente, banco, metodo, rota) -> None:
    # O oráculo que isto fecha: sem sessão, /jogo/validar revelava a resposta
    # certa de qualquer pergunta.
    c, *_ = ambiente
    corpo = {"pergunta_id": "pergunta-1", "resposta_usuario": "A"}
    assert getattr(c, metodo)(rota, json=corpo).status_code == 401


def test_a_rota_publica_de_perguntas_ja_nao_existe(ambiente, banco) -> None:
    c, *_ = ambiente
    assert c.get("/jogo/pergunta-aleatoria", params={"patamar": 1}).status_code in (404, 405)


# --- Perguntas da partida ------------------------------------------------------


def test_pergunta_da_partida_nunca_expoe_a_resposta(ambiente, banco) -> None:
    c, *_ = ambiente
    _entrar(ambiente)
    corpo = _pergunta(c)
    assert set(corpo) == {"id", "texto_pergunta", "opcao_a", "opcao_b", "opcao_c", "opcao_d", "patamar"}
    assert corpo["patamar"] == 1 and corpo["texto_pergunta"] == "nível 1?"


def test_o_nivel_sai_do_patamar_da_partida(ambiente, banco) -> None:
    c, *_ = ambiente
    _entrar(ambiente)
    for _ in range(5):
        _responder(c)
    corpo = _pergunta(c)
    assert (corpo["patamar"], corpo["texto_pergunta"]) == (6, "nível 2?")


def test_sem_perguntas_devolve_404(ambiente) -> None:
    c, *_ = ambiente
    _entrar(ambiente)
    assert c.post("/jogo/partidas/atual/pergunta").status_code == 404


def test_validar_uma_pergunta_que_a_partida_nao_entregou_devolve_409(ambiente, banco, repo_partidas) -> None:
    c, repo, *_ = ambiente
    _entrar(ambiente)
    _pergunta(c)
    outra = repo.criar("outra?", "a", "b", "c", "d", "A", 1, "segredo")

    resposta = c.post("/jogo/validar", json={"pergunta_id": outra.id, "resposta_usuario": "A"})

    assert resposta.status_code == 409
    assert "segredo" not in resposta.text and "resposta_correta" not in resposta.text
    assert repo_partidas.obter_ativa("id-comum").patamar_superado == 0


def test_validar_sem_ter_pedido_pergunta_devolve_409(ambiente, banco) -> None:
    c, *_ = ambiente
    _entrar(ambiente)
    resposta = c.post("/jogo/validar", json={"pergunta_id": "pergunta-1", "resposta_usuario": "C"})
    assert resposta.status_code == 409


def test_responder_duas_vezes_a_mesma_pergunta_conta_uma(ambiente, banco, repo_partidas) -> None:
    c, *_ = ambiente
    _entrar(ambiente)
    primeira = _responder(c)
    repetida = c.post(
        "/jogo/validar", json={"pergunta_id": primeira["pergunta"]["id"], "resposta_usuario": "C"}
    )
    assert repetida.status_code == 409
    assert repo_partidas.obter_ativa("id-comum").patamar_superado == 1


def test_trocar_pergunta_so_uma_vez_por_partida(ambiente, banco) -> None:
    c, repo, *_ = ambiente
    repo.criar("outra fácil?", "a", "b", "c", "d", "C", 1, None)
    _entrar(ambiente)
    primeira = _pergunta(c)
    segunda = _pergunta(c)
    assert segunda["id"] != primeira["id"]
    assert c.post("/jogo/partidas/atual/pergunta").status_code == 409


def test_validar_resposta_correta_revela_e_explica(ambiente, banco) -> None:
    c, *_ = ambiente
    _entrar(ambiente)
    corpo = _responder(c)["corpo"]
    assert corpo["correta"] is True
    assert corpo["resposta_correta"] == "C"
    assert corpo["explicacao"] == "explicação 1"
    assert corpo["sequencia_acertos"] == 1
    assert corpo["recompensa_sequencia"] is None


# --- Sequências de acertos ----------------------------------------------------


def test_terceiro_acerto_seguido_credita_10_diamantes_na_hora(ambiente, banco, repo_perfil) -> None:
    c, *_ = ambiente
    _entrar(ambiente)
    _responder(c)
    _responder(c)

    corpo = _responder(c)["corpo"]

    assert corpo["sequencia_acertos"] == 3
    recompensa = corpo["recompensa_sequencia"]
    assert (recompensa["sequencia"], recompensa["diamantes"]) == (3, 10)
    assert recompensa["perfil"]["diamantes"] == 10
    assert recompensa["perfil"]["melhor_sequencia"] == 3
    assert repo_perfil.obter_ou_criar("id-comum").diamantes == 10


def test_marcos_seguintes_valem_mais(ambiente, banco, repo_perfil) -> None:
    c, *_ = ambiente
    _entrar(ambiente)
    recompensas = [_responder(c)["corpo"]["recompensa_sequencia"] for _ in range(9)]
    ganhos = [(r["sequencia"], r["diamantes"]) for r in recompensas if r]
    assert ganhos == [(3, 10), (6, 20), (9, 30)]
    assert repo_perfil.obter_ou_criar("id-comum").diamantes == 60


def test_errar_quebra_a_sequencia(ambiente, banco, repo_perfil, repo_partidas) -> None:
    c, *_ = ambiente
    _entrar(ambiente)
    repo_perfil.creditar_diamantes("id-comum", 20)
    _responder(c)
    _responder(c)
    falha = _responder(c, "A")
    c.post("/jogo/partidas/atual/vida-extra")
    c.post("/jogo/validar", json={"pergunta_id": falha["pergunta"]["id"], "resposta_usuario": "C"})
    assert repo_partidas.obter_ativa("id-comum").sequencia_acertos == 1
    assert repo_perfil.obter_ou_criar("id-comum").diamantes == 0  # só pagou a vida extra


# --- Tempo esgotado e ajudas grátis -------------------------------------------


def test_tempo_esgotado_nunca_conta_como_certa_nem_avanca_progresso(ambiente, banco, repo_partidas) -> None:
    c, *_ = ambiente
    _entrar(ambiente)
    pergunta = _pergunta(c)

    resposta = c.post("/jogo/tempo-esgotado", json={"pergunta_id": pergunta["id"]})

    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["correta"] is False and corpo["resposta_correta"] is None
    assert corpo["vida_extra"]["restantes"] == 2
    partida = repo_partidas.obter_ativa("id-comum")
    assert partida.patamar_superado == 0 and partida.estado == "a_aguardar_decisao"


def test_cinquenta_cinquenta_nao_toca_no_progresso_e_so_se_usa_uma_vez(ambiente, banco, repo_partidas) -> None:
    c, *_ = ambiente
    _entrar(ambiente)
    _responder(c)
    pergunta = _pergunta(c)

    resposta = c.post("/jogo/ajudas/cinquenta-cinquenta", json={"pergunta_id": pergunta["id"]})

    assert resposta.status_code == 200
    eliminadas = resposta.json()["opcoes_eliminadas"]
    assert len(eliminadas) == 2 and "C" not in eliminadas
    assert repo_partidas.obter_ativa("id-comum").patamar_superado == 1
    segunda = c.post("/jogo/ajudas/cinquenta-cinquenta", json={"pergunta_id": pergunta["id"]})
    assert segunda.status_code == 409


def test_opiniao_publico_devolve_percentagens_e_nao_revela_mais_nada(ambiente, banco) -> None:
    c, *_ = ambiente
    _entrar(ambiente)
    pergunta = _pergunta(c)
    resposta = c.post("/jogo/ajudas/opiniao-publico", json={"pergunta_id": pergunta["id"]})
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert set(corpo) == {"percentagens"}
    assert sum(corpo["percentagens"].values()) == 100


def test_ajudas_so_para_a_pergunta_da_partida(ambiente, banco) -> None:
    c, repo, *_ = ambiente
    _entrar(ambiente)
    _pergunta(c)
    outra = repo.criar("outra?", "a", "b", "c", "d", "A", 1, None)
    for rota in ("/jogo/ajudas/cinquenta-cinquenta", "/jogo/ajudas/opiniao-publico"):
        assert c.post(rota, json={"pergunta_id": outra.id}).status_code == 409


# --- Partida, vida extra e prémio ----------------------------------------------


def test_iniciar_partida_devolve_o_estado_inicial(ambiente) -> None:
    c, *_ = ambiente
    _entrar(ambiente)
    resposta = c.post("/jogo/partidas")
    assert resposta.status_code == 201
    assert resposta.json() == {
        "estado": "em_curso",
        "patamar_superado": 0,
        "vidas_extra_usadas": 0,
        "cinquenta_cinquenta_usada": False,
        "opiniao_publico_usada": False,
        "trocar_pergunta_usada": False,
        "sequencia_acertos": 0,
    }


def test_errar_esconde_a_resposta_e_oferece_vida_extra(ambiente, banco) -> None:
    c, *_ = ambiente
    _entrar(ambiente)
    corpo = _responder(c, "A")["corpo"]
    assert corpo["correta"] is False
    assert corpo["resposta_correta"] is None and corpo["explicacao"] is None
    assert corpo["vida_extra"] == {"custo": 20, "restantes": 2}


def test_a_aguardar_decisao_nao_se_pede_nova_pergunta(ambiente, banco) -> None:
    c, *_ = ambiente
    _entrar(ambiente)
    _responder(c, "A")
    assert c.post("/jogo/partidas/atual/pergunta").status_code == 409


def test_vida_extra_debita_e_continua_na_mesma_pergunta(ambiente, banco, repo_perfil) -> None:
    c, *_ = ambiente
    _entrar(ambiente)
    repo_perfil.creditar_diamantes("id-comum", 50)
    _responder(c)
    falha = _responder(c, "A")

    resposta = c.post("/jogo/partidas/atual/vida-extra")

    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["perfil"]["diamantes"] == 30
    assert (corpo["pergunta_id"], corpo["opcao_falhada"], corpo["vidas_restantes"]) == (
        falha["pergunta"]["id"],
        "A",
        1,
    )
    certa = c.post("/jogo/validar", json={"pergunta_id": falha["pergunta"]["id"], "resposta_usuario": "C"})
    assert certa.json()["correta"] is True
    assert c.post("/jogo/partidas/atual/terminar").json()["patamar_superado"] == 2


def test_vida_extra_sem_diamantes_devolve_402_sem_debitar(ambiente, banco, repo_perfil, repo_partidas) -> None:
    c, *_ = ambiente
    _entrar(ambiente)
    repo_perfil.creditar_diamantes("id-comum", 19)
    _responder(c, "A")
    assert c.post("/jogo/partidas/atual/vida-extra").status_code == 402
    assert repo_perfil.obter_ou_criar("id-comum").diamantes == 19
    assert repo_partidas.obter_ativa("id-comum").estado == "a_aguardar_decisao"


def test_vida_extra_sem_ter_errado_devolve_409(ambiente, repo_perfil) -> None:
    c, *_ = ambiente
    _entrar(ambiente)
    repo_perfil.creditar_diamantes("id-comum", 100)
    c.post("/jogo/partidas")
    assert c.post("/jogo/partidas/atual/vida-extra").status_code == 409
    assert repo_perfil.obter_ou_criar("id-comum").diamantes == 100


def test_encerrar_revela_a_resposta_e_paga_os_patamares_superados(ambiente, banco) -> None:
    c, *_ = ambiente
    _entrar(ambiente)
    for _ in range(3):
        _responder(c)
    _responder(c, "A")

    corpo = c.post("/jogo/partidas/atual/terminar").json()

    assert (corpo["resposta_correta"], corpo["explicacao"]) == ("C", "explicação 1")
    assert (corpo["patamar_superado"], corpo["moedas_ganhas"], corpo["diamantes_ganhos"]) == (3, 150, 0)
    # 150 moedas do prémio; 10 diamantes da sequência de 3 (não do prémio).
    assert corpo["perfil"]["moedas"] == 150 and corpo["perfil"]["diamantes"] == 10
    assert c.post("/jogo/partidas/atual/terminar").json()["moedas_ganhas"] == 0


def test_recompensas_legado_termina_a_partida(ambiente, banco) -> None:
    c, *_ = ambiente
    _entrar(ambiente)
    for _ in range(5):
        _responder(c)
    corpo = c.post("/jogo/recompensas", json={"patamar_alcancado": 15}).json()
    # O patamar forjado no corpo é ignorado -- paga o que o servidor confirmou.
    assert (corpo["moedas"], corpo["partidas_jogadas"], corpo["patamar_maximo_alcancado"]) == (250, 1, 5)


# --- Mercado -------------------------------------------------------------------


@pytest.fixture
def mercado(ambiente, banco, repo_partidas):
    c, repo, _admin, token, repo_perfil = ambiente
    repo_mercado = RepositorioMercadoFalso(repo_perfil)
    app.dependency_overrides[jogo_router.obter_mercado_jogo_service] = lambda: MercadoJogoService(
        repo_mercado, repo, repo_partidas
    )
    c.cookies.set("access_token", token)
    pergunta = _pergunta(c)
    return c, token, repo_perfil, repo_mercado, pergunta


def test_mercado_exige_sessao(ambiente) -> None:
    c, *_ = ambiente
    assert c.get("/jogo/mercado").status_code == 401
    assert c.post("/jogo/mercado/comprar", json={"vendedor_id": "tio-ze", "pergunta_id": "x"}).status_code == 401


def test_listar_mercado_devolve_catalogo_do_servidor(mercado) -> None:
    c, *_ = mercado
    corpo = c.get("/jogo/mercado").json()
    assert "agora" in corpo
    assert [(v["id"], v["custo_diamantes"], v["precisao"]) for v in corpo["vendedores"]] == [
        (v.id, v.custo_diamantes, v.precisao) for v in VENDEDORES
    ]
    assert all(v["disponivel_em"] is None for v in corpo["vendedores"])


def test_comprar_debita_bloqueia_e_devolve_sugestao(mercado) -> None:
    c, _token, repo_perfil, _, pergunta = mercado
    repo_perfil.creditar_diamantes("id-comum", 50)

    resposta = c.post("/jogo/mercado/comprar", json={"vendedor_id": "mana-fefa", "pergunta_id": pergunta["id"]})

    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["resposta_sugerida"] in {"A", "B", "C", "D"}
    assert corpo["perfil"]["diamantes"] == 50 - 12
    listado = {v["id"]: v["disponivel_em"] for v in c.get("/jogo/mercado").json()["vendedores"]}
    assert listado["mana-fefa"] is not None


def test_comprar_ignora_custo_enviado_pelo_cliente(mercado) -> None:
    c, _token, repo_perfil, _, pergunta = mercado
    repo_perfil.creditar_diamantes("id-comum", 50)
    resposta = c.post(
        "/jogo/mercado/comprar",
        json={"vendedor_id": "kota-beto", "pergunta_id": pergunta["id"], "custo_diamantes": 0, "precisao": 1},
    )
    assert resposta.status_code == 200
    assert resposta.json()["perfil"]["diamantes"] == 50 - 45


def test_comprar_duas_vezes_ao_mesmo_vendedor_devolve_409_sem_debitar(mercado) -> None:
    c, _token, repo_perfil, _, pergunta = mercado
    repo_perfil.creditar_diamantes("id-comum", 50)
    c.post("/jogo/mercado/comprar", json={"vendedor_id": "tio-ze", "pergunta_id": pergunta["id"]})
    resposta = c.post("/jogo/mercado/comprar", json={"vendedor_id": "tio-ze", "pergunta_id": pergunta["id"]})
    assert resposta.status_code == 409
    assert repo_perfil.obter_ou_criar("id-comum").diamantes == 45


def test_comprar_sem_diamantes_devolve_402(mercado) -> None:
    c, _token, _, repo_mercado, pergunta = mercado
    resposta = c.post("/jogo/mercado/comprar", json={"vendedor_id": "tio-ze", "pergunta_id": pergunta["id"]})
    assert resposta.status_code == 402
    assert repo_mercado.bloqueios == {}


def test_comprar_vendedor_inexistente_404_e_pergunta_fora_da_partida_409(mercado) -> None:
    c, _token, repo_perfil, _, pergunta = mercado
    repo_perfil.creditar_diamantes("id-comum", 50)
    assert c.post("/jogo/mercado/comprar", json={"vendedor_id": "x", "pergunta_id": pergunta["id"]}).status_code == 404
    assert c.post("/jogo/mercado/comprar", json={"vendedor_id": "tio-ze", "pergunta_id": "x"}).status_code == 409
    assert repo_perfil.obter_ou_criar("id-comum").diamantes == 50


def test_comprar_com_opcoes_excluidas_invalidas_devolve_422(mercado) -> None:
    c, _token, _, _, pergunta = mercado
    resposta = c.post(
        "/jogo/mercado/comprar",
        json={"vendedor_id": "tio-ze", "pergunta_id": pergunta["id"], "opcoes_excluidas": ["Z"]},
    )
    assert resposta.status_code == 422
