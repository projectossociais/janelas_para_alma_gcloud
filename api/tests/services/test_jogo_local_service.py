from dataclasses import replace
from datetime import UTC, datetime, timedelta

import pytest

from app.repositories.jogo_repository import PerguntaJogoRegisto
from app.repositories.partida_local_jogo_repository import (
    PartidaLocalRegisto,
    PartidaLocalTerminadaRegisto,
)
from app.services.jogo_local_service import (
    LIMITE_DIARIO_MOEDAS,
    MAXIMO_MOEDAS_POR_PARTIDA,
    MOEDAS_POR_ACERTO,
    RONDAS,
    JogoLocalService,
    LimiteDePerguntasError,
    NumeroDeJogadoresInvalidoError,
    PartidaLocalNaoEncontradaError,
    PartidaLocalTerminadaError,
    PerguntaForaDaPartidaLocalError,
    maximo_de_perguntas,
)
from app.services.jogo_service import SemPerguntasError
from tests.services.test_jogo_service import RepositorioPerfisFalso


class RepositorioPerguntasLocaisFalso:
    """`quantas` perguntas por nível; a certa é sempre a "B"."""

    def __init__(self, quantas: int = 40) -> None:
        self.perguntas = [
            PerguntaJogoRegisto(
                id=f"p{nivel}-{i}",
                texto_pergunta=f"Pergunta {i} do nível {nivel}?",
                opcao_a="a",
                opcao_b="b",
                opcao_c="c",
                opcao_d="d",
                resposta_correta="B",
                nivel_dificuldade=nivel,
                explicacao="porque sim",
            )
            for nivel in (1, 2, 3)
            for i in range(quantas)
        ]

    def obter_aleatoria_fora_de(self, nivel_dificuldade: int, excluir_ids: tuple[str, ...] = ()):
        return next(
            (p for p in self.perguntas if p.nivel_dificuldade == nivel_dificuldade and p.id not in excluir_ids),
            None,
        )

    def obter_por_id(self, pergunta_id: str):
        return next((p for p in self.perguntas if p.id == pergunta_id), None)


class RepositorioPartidasLocaisFalso:
    """Mesma semântica do real: transições condicionais, uma partida em
    curso por utilizador, prémio e tecto diário calculados ao terminar."""

    def __init__(self, perfis: RepositorioPerfisFalso) -> None:
        self._perfis = perfis
        self.partidas: dict[str, PartidaLocalRegisto] = {}
        self.terminadas_em: dict[str, datetime] = {}
        self._proximo = 1

    def criar(self, utilizador_id: str, numero_jogadores: int, agora: datetime) -> PartidaLocalRegisto:
        for id_, p in list(self.partidas.items()):
            if p.utilizador_id == utilizador_id and p.estado == "em_curso":
                self.partidas[id_] = replace(p, estado="terminada", moedas_ganhas=0, pergunta_atual_id=None)
                self.terminadas_em[id_] = agora
        registo = PartidaLocalRegisto(
            id=f"local-{self._proximo}",
            utilizador_id=utilizador_id,
            numero_jogadores=numero_jogadores,
            estado="em_curso",
            pergunta_atual_id=None,
            perguntas_entregues=(),
            perguntas_respondidas=0,
            acertos=0,
            moedas_ganhas=None,
        )
        self._proximo += 1
        self.partidas[registo.id] = registo
        return registo

    def obter(self, partida_id: str, utilizador_id: str) -> PartidaLocalRegisto | None:
        p = self.partidas.get(partida_id)
        return p if p is not None and p.utilizador_id == utilizador_id else None

    def definir_pergunta(self, partida_id: str, pergunta_id: str) -> PartidaLocalRegisto | None:
        p = self.partidas.get(partida_id)
        if p is None or p.estado != "em_curso" or p.pergunta_atual_id is not None:
            return None
        novo = replace(p, pergunta_atual_id=pergunta_id, perguntas_entregues=(*p.perguntas_entregues, pergunta_id))
        self.partidas[partida_id] = novo
        return novo

    def registar_resposta(self, partida_id: str, pergunta_id: str, certa: bool) -> PartidaLocalRegisto | None:
        p = self.partidas.get(partida_id)
        if p is None or p.estado != "em_curso" or p.pergunta_atual_id != pergunta_id:
            return None
        novo = replace(
            p,
            pergunta_atual_id=None,
            perguntas_respondidas=p.perguntas_respondidas + 1,
            acertos=p.acertos + (1 if certa else 0),
        )
        self.partidas[partida_id] = novo
        return novo

    def terminar(
        self,
        partida_id: str,
        utilizador_id: str,
        *,
        moedas_por_acerto: int,
        maximo_por_partida: int,
        minimo_respostas: int,
        limite_diario: int,
        agora: datetime,
    ) -> PartidaLocalTerminadaRegisto | None:
        p = self.obter(partida_id, utilizador_id)
        if p is None or p.estado != "em_curso":
            return None
        premio = (
            min(p.acertos * moedas_por_acerto, maximo_por_partida) if p.perguntas_respondidas >= minimo_respostas else 0
        )
        hoje = sum(
            (outra.moedas_ganhas or 0)
            for id_, outra in self.partidas.items()
            if outra.utilizador_id == utilizador_id
            and id_ in self.terminadas_em
            and self.terminadas_em[id_].date() == agora.date()
        )
        creditadas = max(0, min(premio, limite_diario - hoje))
        novo = replace(p, estado="terminada", pergunta_atual_id=None, moedas_ganhas=creditadas)
        self.partidas[partida_id] = novo
        self.terminadas_em[partida_id] = agora
        perfil = self._perfis.obter_ou_criar(utilizador_id)
        perfil = replace(
            perfil, moedas=perfil.moedas + creditadas, moedas_ganhas_total=perfil.moedas_ganhas_total + creditadas
        )
        self._perfis._perfis[utilizador_id] = perfil
        return PartidaLocalTerminadaRegisto(partida=novo, perfil=perfil, premio_sem_limite=premio)


class Relogio:
    def __init__(self) -> None:
        self.agora = datetime(2026, 11, 10, 12, 0, tzinfo=UTC)

    def __call__(self) -> datetime:
        return self.agora


@pytest.fixture
def cenario():
    perfis = RepositorioPerfisFalso()
    partidas = RepositorioPartidasLocaisFalso(perfis)
    perguntas = RepositorioPerguntasLocaisFalso()
    relogio = Relogio()
    return JogoLocalService(perguntas, perfis, partidas, relogio), perfis, partidas, perguntas, relogio


def _jogar(servico: JogoLocalService, partida_id: str, respostas: list[str | None], utilizador: str = "u1") -> None:
    for i, resposta in enumerate(respostas):
        pergunta = servico.nova_pergunta(utilizador, partida_id, patamar=(i % 15) + 1)
        servico.responder(utilizador, partida_id, pergunta.id, resposta)


# --- Iniciar -----------------------------------------------------------------


@pytest.mark.parametrize("numero", [0, 1, 3, 4, 12])
def test_iniciar_so_aceita_2_jogadores(cenario, numero) -> None:
    servico, *_ = cenario
    with pytest.raises(NumeroDeJogadoresInvalidoError):
        servico.iniciar("u1", numero)


def test_iniciar_outra_partida_abandona_a_anterior_sem_premio(cenario) -> None:
    servico, perfis, partidas, *_ = cenario
    primeira = servico.iniciar("u1", 2)
    _jogar(servico, primeira.id, ["B"] * 4)

    segunda = servico.iniciar("u1", 2)

    assert partidas.partidas[primeira.id].estado == "terminada"
    assert partidas.partidas[primeira.id].moedas_ganhas == 0
    assert segunda.estado == "em_curso"
    with pytest.raises(PartidaLocalTerminadaError):
        servico.terminar("u1", primeira.id)
    assert perfis.obter_ou_criar("u1").moedas == 0


# --- Perguntas ---------------------------------------------------------------


def test_nova_pergunta_e_idempotente_ate_ser_respondida(cenario) -> None:
    servico, *_ = cenario
    partida = servico.iniciar("u1", 2)

    primeira = servico.nova_pergunta("u1", partida.id, 1)
    outra_vez = servico.nova_pergunta("u1", partida.id, 9)

    assert outra_vez.id == primeira.id


def test_nova_pergunta_segue_a_dificuldade_do_patamar_e_nao_repete(cenario) -> None:
    servico, *_ = cenario
    partida = servico.iniciar("u1", 2)
    vistas = []
    for patamar in (1, 2, 8, 9, 14, 15):  # 6 perguntas: cabe numa partida de 2
        pergunta = servico.nova_pergunta("u1", partida.id, patamar)
        assert pergunta.nivel_dificuldade == (1 if patamar <= 5 else 2 if patamar <= 10 else 3)
        vistas.append(pergunta.id)
        servico.responder("u1", partida.id, pergunta.id, "A")

    assert len(set(vistas)) == len(vistas)


def test_nova_pergunta_repete_so_quando_o_nivel_se_esgota(cenario) -> None:
    servico, _, _, perguntas, _ = cenario
    perguntas.perguntas = [p for p in perguntas.perguntas if p.id in {"p1-0"}]
    partida = servico.iniciar("u1", 2)
    _jogar(servico, partida.id, ["B"])

    assert servico.nova_pergunta("u1", partida.id, 1).id == "p1-0"


def test_nova_pergunta_sem_perguntas_no_nivel_levanta_sem_perguntas(cenario) -> None:
    servico, _, _, perguntas, _ = cenario
    perguntas.perguntas = []
    partida = servico.iniciar("u1", 2)
    with pytest.raises(SemPerguntasError):
        servico.nova_pergunta("u1", partida.id, 1)


def test_nova_pergunta_tem_limite_por_partida(cenario) -> None:
    servico, *_ = cenario
    partida = servico.iniciar("u1", 2)
    _jogar(servico, partida.id, ["B"] * maximo_de_perguntas(2))

    with pytest.raises(LimiteDePerguntasError):
        servico.nova_pergunta("u1", partida.id, 1)


def test_partida_de_outra_conta_nao_existe(cenario) -> None:
    servico, *_ = cenario
    partida = servico.iniciar("u1", 2)
    pergunta = servico.nova_pergunta("u1", partida.id, 1)

    with pytest.raises(PartidaLocalNaoEncontradaError):
        servico.nova_pergunta("intruso", partida.id, 1)
    with pytest.raises(PartidaLocalNaoEncontradaError):
        servico.responder("intruso", partida.id, pergunta.id, "B")
    with pytest.raises(PartidaLocalNaoEncontradaError):
        servico.terminar("intruso", partida.id)


# --- Respostas ---------------------------------------------------------------


def test_responder_certo_errado_e_tempo_esgotado(cenario) -> None:
    servico, _, partidas, *_ = cenario
    partida = servico.iniciar("u1", 2)

    p1 = servico.nova_pergunta("u1", partida.id, 1)
    certo = servico.responder("u1", partida.id, p1.id, "B")
    p2 = servico.nova_pergunta("u1", partida.id, 1)
    errado = servico.responder("u1", partida.id, p2.id, "C")
    p3 = servico.nova_pergunta("u1", partida.id, 1)
    esgotado = servico.responder("u1", partida.id, p3.id, None)

    assert (certo.correta, errado.correta, esgotado.correta) == (True, False, False)
    assert errado.resposta_correta == "B"
    assert errado.explicacao == "porque sim"
    assert partidas.partidas[partida.id].perguntas_respondidas == 3
    assert partidas.partidas[partida.id].acertos == 1


def test_a_mesma_resposta_nunca_conta_duas_vezes(cenario) -> None:
    servico, _, partidas, *_ = cenario
    partida = servico.iniciar("u1", 2)
    pergunta = servico.nova_pergunta("u1", partida.id, 1)
    servico.responder("u1", partida.id, pergunta.id, "B")

    with pytest.raises(PerguntaForaDaPartidaLocalError):
        servico.responder("u1", partida.id, pergunta.id, "B")
    assert partidas.partidas[partida.id].acertos == 1


def test_responder_a_uma_pergunta_que_nao_foi_entregue_e_recusado(cenario) -> None:
    """Sem isto, qualquer id de pergunta servia de oráculo para a resposta."""
    servico, *_ = cenario
    partida = servico.iniciar("u1", 2)
    servico.nova_pergunta("u1", partida.id, 1)

    with pytest.raises(PerguntaForaDaPartidaLocalError):
        servico.responder("u1", partida.id, "p3-7", "B")


# --- Prémio ------------------------------------------------------------------


def test_terminar_paga_moedas_pelos_acertos_de_todos(cenario) -> None:
    servico, perfis, *_ = cenario
    partida = servico.iniciar("u1", 2)
    respostas = ["B"] * 7 + ["A"] * (2 * RONDAS - 7)
    _jogar(servico, partida.id, respostas)

    terminada = servico.terminar("u1", partida.id)

    assert terminada.moedas_ganhas == 7 * MOEDAS_POR_ACERTO
    assert terminada.limite_diario_atingido is False
    assert terminada.perfil.moedas == 7 * MOEDAS_POR_ACERTO
    assert perfis.obter_ou_criar("u1").moedas_ganhas_total == 7 * MOEDAS_POR_ACERTO
    assert perfis.obter_ou_criar("u1").diamantes == 0


def test_terminar_antes_de_todas_as_rondas_nao_paga(cenario) -> None:
    servico, perfis, *_ = cenario
    partida = servico.iniciar("u1", 2)
    _jogar(servico, partida.id, ["B"] * (2 * RONDAS - 1))

    terminada = servico.terminar("u1", partida.id)

    assert terminada.moedas_ganhas == 0
    assert terminada.limite_diario_atingido is False
    assert perfis.obter_ou_criar("u1").moedas == 0


def test_terminar_tem_tecto_por_partida(cenario) -> None:
    servico, *_ = cenario
    partida = servico.iniciar("u1", 2)
    _jogar(servico, partida.id, ["B"] * maximo_de_perguntas(2))

    assert servico.terminar("u1", partida.id).moedas_ganhas == MAXIMO_MOEDAS_POR_PARTIDA


def test_terminar_duas_vezes_so_paga_uma(cenario) -> None:
    servico, perfis, *_ = cenario
    partida = servico.iniciar("u1", 2)
    _jogar(servico, partida.id, ["B"] * (2 * RONDAS))
    servico.terminar("u1", partida.id)

    with pytest.raises(PartidaLocalTerminadaError):
        servico.terminar("u1", partida.id)
    assert perfis.obter_ou_criar("u1").moedas == 2 * RONDAS * MOEDAS_POR_ACERTO


def test_limite_diario_de_moedas_e_novo_dia(cenario) -> None:
    servico, perfis, _, _, relogio = cenario
    por_partida = 2 * RONDAS * MOEDAS_POR_ACERTO
    assert por_partida == MAXIMO_MOEDAS_POR_PARTIDA
    partidas_ate_ao_limite = LIMITE_DIARIO_MOEDAS // por_partida

    for _ in range(partidas_ate_ao_limite):
        partida = servico.iniciar("u1", 2)
        _jogar(servico, partida.id, ["B"] * (2 * RONDAS))
        assert servico.terminar("u1", partida.id).limite_diario_atingido is False

    partida = servico.iniciar("u1", 2)
    _jogar(servico, partida.id, ["B"] * (2 * RONDAS))
    acima = servico.terminar("u1", partida.id)
    assert acima.moedas_ganhas == 0
    assert acima.limite_diario_atingido is True
    assert perfis.obter_ou_criar("u1").moedas == LIMITE_DIARIO_MOEDAS

    relogio.agora += timedelta(days=1)
    partida = servico.iniciar("u1", 2)
    _jogar(servico, partida.id, ["B"] * (2 * RONDAS))
    amanha = servico.terminar("u1", partida.id)
    assert amanha.moedas_ganhas == 2 * RONDAS * MOEDAS_POR_ACERTO
    assert amanha.limite_diario_atingido is False


def test_limite_diario_credita_so_o_que_falta(cenario) -> None:
    servico, perfis, _, _, _ = cenario
    # 100 + 100 + 100 + 70 = 370; a quinta (100) só pode creditar 30.
    for acertos in (10, 10, 10, 7):
        partida = servico.iniciar("u1", 2)
        _jogar(servico, partida.id, ["B"] * acertos + ["A"] * (10 - acertos))
        servico.terminar("u1", partida.id)
    partida = servico.iniciar("u1", 2)
    _jogar(servico, partida.id, ["B"] * 10)

    quinta = servico.terminar("u1", partida.id)

    assert quinta.moedas_ganhas == 30
    assert quinta.limite_diario_atingido is True
    assert perfis.obter_ou_criar("u1").moedas == LIMITE_DIARIO_MOEDAS


def test_o_limite_diario_e_por_conta(cenario) -> None:
    servico, perfis, *_ = cenario
    for _ in range(5):
        partida = servico.iniciar("u1", 2)
        _jogar(servico, partida.id, ["B"] * 10)
        servico.terminar("u1", partida.id)
    partida = servico.iniciar("u2", 2)
    _jogar(servico, partida.id, ["B"] * 10, utilizador="u2")

    assert servico.terminar("u2", partida.id).moedas_ganhas == 100
    assert perfis.obter_ou_criar("u2").moedas == 100
