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

    def obter_aleatoria(self, nivel_dificuldade: int | None = None) -> PerguntaJogoRegisto | None:
        candidatas = self._perguntas
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


# --- Leitura pública ---------------------------------------------------------


def test_sem_patamar_devolve_422(ambiente) -> None:
    c, *_ = ambiente
    assert c.get("/jogo/pergunta-aleatoria").status_code == 422


def test_patamar_fora_do_intervalo_devolve_422(ambiente) -> None:
    c, *_ = ambiente
    assert c.get("/jogo/pergunta-aleatoria", params={"patamar": 0}).status_code == 422
    assert c.get("/jogo/pergunta-aleatoria", params={"patamar": 16}).status_code == 422


def test_sem_perguntas_devolve_404(ambiente) -> None:
    c, *_ = ambiente
    resposta = c.get("/jogo/pergunta-aleatoria", params={"patamar": 1})
    assert resposta.status_code == 404


def test_pergunta_aleatoria_nunca_expoe_resposta_correta_nem_explicacao(ambiente) -> None:
    # A regra central desta feature: quem lê a rede antes de responder não
    # pode encontrar a resposta certa em lado nenhum do payload.
    c, repo, *_ = ambiente
    repo.criar("2+2?", "1", "2", "3", "4", "D", 1, "porque sim")

    resposta = c.get("/jogo/pergunta-aleatoria", params={"patamar": 1})
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["texto_pergunta"] == "2+2?"
    assert set(corpo.keys()) == {"id", "texto_pergunta", "opcao_a", "opcao_b", "opcao_c", "opcao_d"}
    assert "resposta_correta" not in corpo
    assert "explicacao" not in corpo


@pytest.mark.parametrize(
    ("patamar", "nivel_esperado"),
    [(1, 1), (5, 1), (6, 2), (10, 2), (11, 3), (15, 3)],
)
def test_pergunta_aleatoria_mapeia_patamar_para_nivel_dificuldade(ambiente, patamar, nivel_esperado) -> None:
    c, repo, *_ = ambiente
    for nivel in (1, 2, 3):
        repo.criar(f"pergunta nível {nivel}", "a", "b", "c", "d", "A", nivel, None)

    resposta = c.get("/jogo/pergunta-aleatoria", params={"patamar": patamar})
    assert resposta.status_code == 200
    assert resposta.json()["texto_pergunta"] == f"pergunta nível {nivel_esperado}"


# --- Validação ---------------------------------------------------------------


def test_validar_com_pergunta_inexistente_devolve_404(ambiente) -> None:
    c, *_ = ambiente
    resposta = c.post("/jogo/validar", json={"pergunta_id": "pergunta-999", "resposta_usuario": "A"})
    assert resposta.status_code == 404


def test_validar_resposta_correta(ambiente) -> None:
    c, repo, *_ = ambiente
    pergunta = repo.criar("2+2?", "1", "2", "3", "4", "D", 1, "porque sim")

    resposta = c.post("/jogo/validar", json={"pergunta_id": pergunta.id, "resposta_usuario": "D"})
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["correta"] is True
    assert corpo["resposta_correta"] == "D"
    assert corpo["explicacao"] == "porque sim"


def test_validar_resposta_errada_revela_a_certa(ambiente) -> None:
    # O frontend usa `resposta_correta` desta resposta para piscar a
    # vermelho a opção escolhida e a verde a certa -- só pode chegar aqui,
    # nunca antes de o utilizador responder.
    c, repo, *_ = ambiente
    pergunta = repo.criar("2+2?", "1", "2", "3", "4", "D", 1, "porque sim")

    resposta = c.post("/jogo/validar", json={"pergunta_id": pergunta.id, "resposta_usuario": "A"})
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["correta"] is False
    assert corpo["resposta_correta"] == "D"


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
    }


def test_registar_recompensa_sem_sessao_devolve_401(ambiente) -> None:
    c, *_ = ambiente
    assert c.post("/jogo/recompensas").status_code == 401


def _responder_certo(c, repo, texto: str, nivel: int) -> None:
    pergunta = repo.criar(texto, "a", "b", "c", "d", "A", nivel, None)
    resposta = c.post("/jogo/validar", json={"pergunta_id": pergunta.id, "resposta_usuario": "A"})
    assert resposta.status_code == 200
    assert resposta.json()["correta"] is True


def test_registar_recompensa_sem_ter_respondido_nada_nao_paga_nada(ambiente) -> None:
    # O buraco original: chamar /jogo/recompensas directamente (o endpoint
    # já não aceita sequer um `patamar_alcancado` no corpo) sem nunca ter
    # respondido a uma pergunta. Antes desta correcção, um pedido forjado a
    # mandar {"patamar_alcancado": 15} dava o prémio máximo.
    c, _, _, token_comum, _ = ambiente
    c.cookies.set("access_token", token_comum)

    resposta = c.post("/jogo/recompensas")
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["moedas"] == 0
    assert corpo["diamantes"] == 0


def test_registar_recompensa_calcula_moedas_e_diamantes_a_partir_do_progresso_real(ambiente) -> None:
    c, repo, _, token_comum, _ = ambiente
    c.cookies.set("access_token", token_comum)

    for i in range(5):
        _responder_certo(c, repo, f"pergunta {i}", nivel=1)

    resposta = c.post("/jogo/recompensas")
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["moedas"] == 250  # 5 patamares x 50 moedas
    assert corpo["diamantes"] == 1  # marco do patamar 5
    assert corpo["partidas_jogadas"] == 1
    assert corpo["patamar_maximo_alcancado"] == 5


def test_registar_recompensa_acumula_entre_partidas(ambiente) -> None:
    c, repo, _, token_comum, _ = ambiente
    c.cookies.set("access_token", token_comum)

    for i in range(3):
        _responder_certo(c, repo, f"pergunta a {i}", nivel=1)
    c.post("/jogo/recompensas")

    for i in range(2):
        _responder_certo(c, repo, f"pergunta b {i}", nivel=1)
    resposta = c.post("/jogo/recompensas")

    corpo = resposta.json()
    assert corpo["moedas"] == 250  # (3 + 2) x 50
    assert corpo["partidas_jogadas"] == 2
    # o máximo alcançado não desce quando uma partida seguinte vai pior.
    assert corpo["patamar_maximo_alcancado"] == 3


def test_um_pedido_forjado_com_patamar_no_corpo_e_ignorado(ambiente) -> None:
    # A correcção central: mesmo mandando um `patamar_alcancado` forjado no
    # corpo (campo que o schema já nem declara), o servidor ignora-o por
    # completo -- paga sempre com base no que rastreou.
    c, _, _, token_comum, _ = ambiente
    c.cookies.set("access_token", token_comum)

    resposta = c.post("/jogo/recompensas", json={"patamar_alcancado": 15})
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["moedas"] == 0
    assert corpo["diamantes"] == 0


def test_responder_de_nivel_errado_nao_conta_para_a_recompensa(ambiente) -> None:
    # Reutilizar perguntas fáceis (nível 1) depois de já se ter esgotado
    # esse nível não infla o patamar em curso nem a recompensa.
    c, repo, _, token_comum, _ = ambiente
    c.cookies.set("access_token", token_comum)

    for i in range(5):
        _responder_certo(c, repo, f"facil {i}", nivel=1)
    # Nível 1 esgotado (patamar 5 superado) -- mais uma pergunta fácil.
    _responder_certo(c, repo, "facil extra", nivel=1)

    resposta = c.post("/jogo/recompensas")
    assert resposta.json()["moedas"] == 250  # continua só 5 patamares, não 6


def test_validar_sem_sessao_funciona_mas_nao_faz_ninguem_ganhar_nada(ambiente) -> None:
    # Jogar sem conta continua a mostrar as respostas certas -- só não
    # acumula progresso nenhum (não há perfil para guardar; e sem sessão
    # nunca chega a /jogo/recompensas, que exige sessão).
    c, repo, _, _, repo_perfil = ambiente
    pergunta = repo.criar("2+2?", "1", "2", "3", "4", "A", 1, None)

    resposta = c.post("/jogo/validar", json={"pergunta_id": pergunta.id, "resposta_usuario": "A"})

    assert resposta.status_code == 200
    assert resposta.json()["correta"] is True
    assert repo_perfil._perfis == {}


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


# --- Tempo esgotado e ajudas grátis -----------------------------------------


def test_tempo_esgotado_nunca_conta_como_certa_nem_avanca_progresso(ambiente, repo_partidas) -> None:
    c, repo, _admin, token, _ = ambiente
    pergunta = repo.criar("2+2?", "4", "1", "2", "3", "A", 1, "porque sim")
    c.cookies.set("access_token", token)
    c.post("/jogo/partidas")

    resposta = c.post("/jogo/tempo-esgotado", json={"pergunta_id": pergunta.id})

    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["correta"] is False
    assert corpo["resposta_correta"] is None  # só se revela ao terminar
    assert corpo["vida_extra"]["restantes"] == 2
    partida = repo_partidas.obter_ativa("id-comum")
    assert partida.patamar_superado == 0 and partida.estado == "a_aguardar_decisao"


def test_tempo_esgotado_sem_sessao_funciona_e_pergunta_inexistente_404(ambiente) -> None:
    c, repo, *_ = ambiente
    pergunta = repo.criar("2+2?", "4", "1", "2", "3", "A", 1, None)
    assert c.post("/jogo/tempo-esgotado", json={"pergunta_id": pergunta.id}).status_code == 200
    assert c.post("/jogo/tempo-esgotado", json={"pergunta_id": "nao-existe"}).status_code == 404


def test_cinquenta_cinquenta_nao_toca_no_progresso_e_so_se_usa_uma_vez(ambiente, repo_partidas) -> None:
    c, repo, _admin, token, _ = ambiente
    pergunta = repo.criar("2+2?", "1", "4", "2", "3", "B", 1, None)
    c.cookies.set("access_token", token)
    c.post("/jogo/partidas")
    _responder_certo(c, repo, "aquecimento", nivel=1)

    resposta = c.post("/jogo/ajudas/cinquenta-cinquenta", json={"pergunta_id": pergunta.id})

    assert resposta.status_code == 200
    eliminadas = resposta.json()["opcoes_eliminadas"]
    assert len(eliminadas) == 2 and "B" not in eliminadas
    assert repo_partidas.obter_ativa("id-comum").patamar_superado == 1
    segunda = c.post("/jogo/ajudas/cinquenta-cinquenta", json={"pergunta_id": pergunta.id})
    assert segunda.status_code == 409


def test_opiniao_publico_devolve_percentagens_e_nao_revela_mais_nada(ambiente) -> None:
    c, repo, *_ = ambiente
    pergunta = repo.criar("2+2?", "1", "2", "4", "3", "C", 1, "segredo")

    resposta = c.post("/jogo/ajudas/opiniao-publico", json={"pergunta_id": pergunta.id})

    assert resposta.status_code == 200
    corpo = resposta.json()
    assert set(corpo) == {"percentagens"}
    assert sum(corpo["percentagens"].values()) == 100


def test_ajudas_com_pergunta_inexistente_devolvem_404(ambiente) -> None:
    c, *_ = ambiente
    for rota in ("/jogo/ajudas/cinquenta-cinquenta", "/jogo/ajudas/opiniao-publico"):
        assert c.post(rota, json={"pergunta_id": "nao-existe"}).status_code == 404


# --- Mercado -----------------------------------------------------------------


@pytest.fixture
def mercado(ambiente):
    c, repo, _admin, token, repo_perfil = ambiente
    repo_mercado = RepositorioMercadoFalso(repo_perfil)
    app.dependency_overrides[jogo_router.obter_mercado_jogo_service] = lambda: MercadoJogoService(
        repo_mercado, repo
    )
    pergunta = repo.criar("2+2?", "1", "2", "3", "4", "D", 1, None)
    return c, token, repo_perfil, repo_mercado, pergunta


def test_mercado_exige_sessao(mercado) -> None:
    c, *_ = mercado
    assert c.get("/jogo/mercado").status_code == 401
    assert c.post("/jogo/mercado/comprar", json={"vendedor_id": "tio-ze", "pergunta_id": "x"}).status_code == 401


def test_listar_mercado_devolve_catalogo_do_servidor(mercado) -> None:
    c, token, *_ = mercado
    c.cookies.set("access_token", token)

    corpo = c.get("/jogo/mercado").json()

    assert "agora" in corpo
    assert [(v["id"], v["custo_diamantes"], v["precisao"]) for v in corpo["vendedores"]] == [
        (v.id, v.custo_diamantes, v.precisao) for v in VENDEDORES
    ]
    assert all(v["disponivel_em"] is None for v in corpo["vendedores"])


def test_comprar_debita_bloqueia_e_devolve_sugestao(mercado) -> None:
    c, token, repo_perfil, _, pergunta = mercado
    c.cookies.set("access_token", token)
    repo_perfil.creditar_diamantes("id-comum", 50)

    resposta = c.post("/jogo/mercado/comprar", json={"vendedor_id": "mana-fefa", "pergunta_id": pergunta.id})

    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["resposta_sugerida"] in {"A", "B", "C", "D"}
    assert corpo["perfil"]["diamantes"] == 50 - 12
    listado = {v["id"]: v["disponivel_em"] for v in c.get("/jogo/mercado").json()["vendedores"]}
    assert listado["mana-fefa"] is not None


def test_comprar_ignora_custo_enviado_pelo_cliente(mercado) -> None:
    c, token, repo_perfil, _, pergunta = mercado
    c.cookies.set("access_token", token)
    repo_perfil.creditar_diamantes("id-comum", 50)

    resposta = c.post(
        "/jogo/mercado/comprar",
        json={"vendedor_id": "kota-beto", "pergunta_id": pergunta.id, "custo_diamantes": 0, "precisao": 1},
    )

    assert resposta.status_code == 200
    assert resposta.json()["perfil"]["diamantes"] == 50 - 45


def test_comprar_duas_vezes_ao_mesmo_vendedor_devolve_409_sem_debitar(mercado) -> None:
    c, token, repo_perfil, _, pergunta = mercado
    c.cookies.set("access_token", token)
    repo_perfil.creditar_diamantes("id-comum", 50)
    c.post("/jogo/mercado/comprar", json={"vendedor_id": "tio-ze", "pergunta_id": pergunta.id})

    resposta = c.post("/jogo/mercado/comprar", json={"vendedor_id": "tio-ze", "pergunta_id": pergunta.id})

    assert resposta.status_code == 409
    assert repo_perfil.obter_ou_criar("id-comum").diamantes == 45


def test_comprar_sem_diamantes_devolve_402(mercado) -> None:
    c, token, _, repo_mercado, pergunta = mercado
    c.cookies.set("access_token", token)

    resposta = c.post("/jogo/mercado/comprar", json={"vendedor_id": "tio-ze", "pergunta_id": pergunta.id})

    assert resposta.status_code == 402
    assert repo_mercado.bloqueios == {}


def test_comprar_vendedor_ou_pergunta_inexistente_devolve_404(mercado) -> None:
    c, token, repo_perfil, _, pergunta = mercado
    c.cookies.set("access_token", token)
    repo_perfil.creditar_diamantes("id-comum", 50)
    assert c.post("/jogo/mercado/comprar", json={"vendedor_id": "x", "pergunta_id": pergunta.id}).status_code == 404
    assert c.post("/jogo/mercado/comprar", json={"vendedor_id": "tio-ze", "pergunta_id": "x"}).status_code == 404
    assert repo_perfil.obter_ou_criar("id-comum").diamantes == 50


def test_comprar_com_opcoes_excluidas_invalidas_devolve_422(mercado) -> None:
    c, token, _, _, pergunta = mercado
    c.cookies.set("access_token", token)
    resposta = c.post(
        "/jogo/mercado/comprar",
        json={"vendedor_id": "tio-ze", "pergunta_id": pergunta.id, "opcoes_excluidas": ["Z"]},
    )
    assert resposta.status_code == 422


# --- Partida e vida extra ----------------------------------------------------


def _errar(c, repo, texto: str = "errada?", nivel: int = 1) -> dict:
    pergunta = repo.criar(texto, "a", "b", "c", "d", "C", nivel, "explicação")
    resposta = c.post("/jogo/validar", json={"pergunta_id": pergunta.id, "resposta_usuario": "A"})
    assert resposta.status_code == 200
    return {"pergunta": pergunta, "corpo": resposta.json()}


def test_partidas_exigem_sessao(ambiente) -> None:
    c, *_ = ambiente
    assert c.post("/jogo/partidas").status_code == 401
    assert c.post("/jogo/partidas/atual/vida-extra").status_code == 401
    assert c.post("/jogo/partidas/atual/terminar").status_code == 401


def test_iniciar_partida_devolve_o_estado_inicial(ambiente) -> None:
    c, _repo, _admin, token, _ = ambiente
    c.cookies.set("access_token", token)
    resposta = c.post("/jogo/partidas")
    assert resposta.status_code == 201
    assert resposta.json() == {
        "estado": "em_curso",
        "patamar_superado": 0,
        "vidas_extra_usadas": 0,
        "cinquenta_cinquenta_usada": False,
        "opiniao_publico_usada": False,
    }


def test_errar_com_sessao_esconde_a_resposta_e_oferece_vida_extra(ambiente) -> None:
    c, repo, _admin, token, _ = ambiente
    c.cookies.set("access_token", token)
    c.post("/jogo/partidas")

    corpo = _errar(c, repo)["corpo"]

    assert corpo == {
        "correta": False,
        "resposta_correta": None,
        "explicacao": None,
        "vida_extra": {"custo": 20, "restantes": 2},
    }


def test_a_aguardar_decisao_validar_outra_pergunta_devolve_409(ambiente) -> None:
    c, repo, _admin, token, _ = ambiente
    c.cookies.set("access_token", token)
    c.post("/jogo/partidas")
    _errar(c, repo)
    outra = repo.criar("outra?", "a", "b", "c", "d", "A", 1, None)
    resposta = c.post("/jogo/validar", json={"pergunta_id": outra.id, "resposta_usuario": "A"})
    assert resposta.status_code == 409


def test_vida_extra_debita_e_devolve_a_pergunta_e_a_opcao_a_esconder(ambiente, repo_perfil) -> None:
    c, repo, _admin, token, _ = ambiente
    c.cookies.set("access_token", token)
    repo_perfil.creditar_diamantes("id-comum", 50)
    c.post("/jogo/partidas")
    _responder_certo(c, repo, "certa 1", nivel=1)
    falha = _errar(c, repo)

    resposta = c.post("/jogo/partidas/atual/vida-extra")

    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["perfil"]["diamantes"] == 30
    assert corpo["pergunta_id"] == falha["pergunta"].id
    assert corpo["opcao_falhada"] == "A"
    assert corpo["vidas_restantes"] == 1
    # Continua no mesmo patamar: acertar agora sobe para o 2.
    certa = c.post("/jogo/validar", json={"pergunta_id": falha["pergunta"].id, "resposta_usuario": "C"})
    assert certa.json()["correta"] is True
    terminada = c.post("/jogo/partidas/atual/terminar").json()
    assert terminada["patamar_superado"] == 2


def test_vida_extra_sem_diamantes_devolve_402_sem_debitar(ambiente, repo_perfil, repo_partidas) -> None:
    c, repo, _admin, token, _ = ambiente
    c.cookies.set("access_token", token)
    repo_perfil.creditar_diamantes("id-comum", 19)
    c.post("/jogo/partidas")
    _errar(c, repo)

    resposta = c.post("/jogo/partidas/atual/vida-extra")

    assert resposta.status_code == 402
    assert repo_perfil.obter_ou_criar("id-comum").diamantes == 19
    assert repo_partidas.obter_ativa("id-comum").estado == "a_aguardar_decisao"


def test_vida_extra_sem_ter_errado_devolve_409(ambiente, repo_perfil) -> None:
    c, _repo, _admin, token, _ = ambiente
    c.cookies.set("access_token", token)
    repo_perfil.creditar_diamantes("id-comum", 100)
    c.post("/jogo/partidas")
    assert c.post("/jogo/partidas/atual/vida-extra").status_code == 409
    assert repo_perfil.obter_ou_criar("id-comum").diamantes == 100


def test_vida_extra_esgota_depois_do_limite(ambiente, repo_perfil) -> None:
    c, repo, _admin, token, _ = ambiente
    c.cookies.set("access_token", token)
    repo_perfil.creditar_diamantes("id-comum", 100)
    c.post("/jogo/partidas")
    for i in range(2):
        _errar(c, repo, f"errada {i}")
        assert c.post("/jogo/partidas/atual/vida-extra").status_code == 200

    assert _errar(c, repo, "errada 3")["corpo"]["vida_extra"]["restantes"] == 0
    assert c.post("/jogo/partidas/atual/vida-extra").status_code == 409
    assert repo_perfil.obter_ou_criar("id-comum").diamantes == 60


def test_encerrar_revela_a_resposta_e_paga_os_patamares_superados(ambiente) -> None:
    c, repo, _admin, token, _ = ambiente
    c.cookies.set("access_token", token)
    c.post("/jogo/partidas")
    for i in range(3):
        _responder_certo(c, repo, f"certa {i}", nivel=1)
    _errar(c, repo)

    resposta = c.post("/jogo/partidas/atual/terminar")

    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["resposta_correta"] == "C"
    assert corpo["explicacao"] == "explicação"
    assert (corpo["patamar_superado"], corpo["moedas_ganhas"], corpo["diamantes_ganhos"]) == (3, 150, 0)
    assert corpo["perfil"]["moedas"] == 150 and corpo["perfil"]["partidas_jogadas"] == 1
    # Segunda vez: já não há partida aberta, não paga outra vez.
    assert c.post("/jogo/partidas/atual/terminar").json()["moedas_ganhas"] == 0
