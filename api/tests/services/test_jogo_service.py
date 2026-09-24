"""Testes do `JogoService` -- as mentiras que este serviço existe para
impedir: responder a uma pergunta que a partida não entregou (usar o servidor
como oráculo), reclamar mais patamares, sequências, ajudas ou vidas extra do
que os que o servidor confirmou."""

from dataclasses import replace
from datetime import UTC, date, datetime, timedelta

import pytest

from app.repositories.estatisticas_jogo_repository import EstatisticaCategoriaRegisto
from app.repositories.jogo_repository import PerguntaJogoRegisto
from app.repositories.partida_jogo_repository import (
    AcertoRegisto,
    PartidaRegisto,
    PartidaTerminadaRegisto,
    ResultadoVidaExtra,
)
from app.repositories.perfil_jogador_repository import PerfilJogadorRegisto
from app.services.jogo_service import (
    CUSTO_VIDA_EXTRA,
    LIMITE_DIARIO_DIAMANTES_SEQUENCIA,
    MAXIMO_VIDAS_EXTRA_POR_PARTIDA,
    AjudaJaUsadaError,
    DiamantesInsuficientesError,
    JogoService,
    PartidaADecidirError,
    PartidaCompletaError,
    PerguntaForaDaPartidaError,
    SemPerguntasError,
    VidaExtraIndisponivelError,
    recompensa_sequencia,
)


class RepositorioPerguntasFalso:
    def __init__(self) -> None:
        self._perguntas: dict[str, PerguntaJogoRegisto] = {}

    def adicionar(
        self, pergunta_id: str, resposta_correta: str, nivel_dificuldade: int, categoria: str = "curiosidades_visuais"
    ) -> None:
        self._perguntas[pergunta_id] = PerguntaJogoRegisto(
            id=pergunta_id,
            texto_pergunta="pergunta",
            opcao_a="A",
            opcao_b="B",
            opcao_c="C",
            opcao_d="D",
            resposta_correta=resposta_correta,
            nivel_dificuldade=nivel_dificuldade,
            explicacao="explicação",
            categoria=categoria,
        )

    def obter_aleatoria(
        self, nivel_dificuldade: int | None = None, excluir_id: str | None = None
    ) -> PerguntaJogoRegisto | None:
        # Determinista: a primeira do nível, pela ordem em que foram criadas.
        return next(
            (
                p
                for p in self._perguntas.values()
                if (nivel_dificuldade is None or p.nivel_dificuldade == nivel_dificuldade) and p.id != excluir_id
            ),
            None,
        )

    def obter_por_id(self, pergunta_id: str) -> PerguntaJogoRegisto | None:
        return self._perguntas.get(pergunta_id)

    def criar(self, *a, **k) -> PerguntaJogoRegisto:
        raise NotImplementedError


class RepositorioPerfisFalso:
    def __init__(self) -> None:
        self._perfis: dict[str, PerfilJogadorRegisto] = {}

    def obter_ou_criar(self, utilizador_id: str) -> PerfilJogadorRegisto:
        if utilizador_id not in self._perfis:
            self._perfis[utilizador_id] = PerfilJogadorRegisto(
                id=f"perfil-{utilizador_id}",
                utilizador_id=utilizador_id,
                moedas=0,
                diamantes=0,
                partidas_jogadas=0,
                patamar_maximo_alcancado=0,
                melhor_sequencia=0,
            )
        return self._perfis[utilizador_id]

    def creditar_diamantes(self, utilizador_id: str, quantidade: int) -> PerfilJogadorRegisto:
        atual = self.obter_ou_criar(utilizador_id)
        novo = replace(atual, diamantes=atual.diamantes + quantidade)
        self._perfis[utilizador_id] = novo
        return novo


class RepositorioPartidasFalso:
    """Mesma semântica do repositório real: transições condicionais, e
    vida extra / terminar gravam partida e saldo juntos, ou nada."""

    def __init__(self, perfis: RepositorioPerfisFalso) -> None:
        self._perfis = perfis
        self.partidas: dict[str, PartidaRegisto] = {}
        self._proximo = 1
        # utilizador -> (dia UTC, diamantes de sequências ganhos nesse dia)
        self.ganho_sequencias_por_dia: dict[str, tuple[date, int]] = {}
        # (utilizador, categoria) -> [respostas, acertos]
        self.estatisticas: dict[tuple[str, str], list[int]] = {}

    def _contar(self, utilizador_id: str, categoria: str, certa: bool) -> None:
        linha = self.estatisticas.setdefault((utilizador_id, categoria), [0, 0])
        linha[0] += 1
        linha[1] += int(certa)

    def listar_por_categoria(self, utilizador_id: str) -> list[EstatisticaCategoriaRegisto]:
        """Faz também de `EstatisticasJogoRepository` -- lê o que se contou aqui."""
        return [
            EstatisticaCategoriaRegisto(categoria, respostas, acertos)
            for (u, categoria), (respostas, acertos) in self.estatisticas.items()
            if u == utilizador_id
        ]

    def obter_ativa(self, utilizador_id: str) -> PartidaRegisto | None:
        return next(
            (p for p in self.partidas.values() if p.utilizador_id == utilizador_id and p.estado != "terminada"),
            None,
        )

    def criar(self, utilizador_id: str) -> PartidaRegisto:
        ativa = self.obter_ativa(utilizador_id)
        if ativa is not None:
            return ativa
        partida = PartidaRegisto(
            id=f"partida-{self._proximo}",
            utilizador_id=utilizador_id,
            estado="em_curso",
            patamar_superado=0,
            vidas_extra_usadas=0,
            cinquenta_cinquenta_usada=False,
            opiniao_publico_usada=False,
            trocar_pergunta_usada=False,
            pergunta_atual_id=None,
            opcao_falhada=None,
            sequencia_acertos=0,
            diamantes_sequencia=0,
            moedas_ganhas=None,
            diamantes_ganhos=None,
        )
        self._proximo += 1
        self.partidas[partida.id] = partida
        return partida

    def _atualizar(self, partida_id: str, condicao, **valores) -> PartidaRegisto | None:
        atual = self.partidas.get(partida_id)
        if atual is None or not condicao(atual):
            return None
        novo = replace(atual, **valores)
        self.partidas[partida_id] = novo
        return novo

    def definir_pergunta(self, partida_id: str, pergunta_id: str, troca: bool) -> PartidaRegisto | None:
        if troca:
            return self._atualizar(
                partida_id,
                lambda p: p.estado == "em_curso" and not p.trocar_pergunta_usada,
                pergunta_atual_id=pergunta_id,
                opcao_falhada=None,
                trocar_pergunta_usada=True,
            )
        return self._atualizar(
            partida_id, lambda p: p.estado == "em_curso", pergunta_atual_id=pergunta_id, opcao_falhada=None
        )

    def registar_acerto(
        self,
        partida_id: str,
        utilizador_id: str,
        pergunta_id: str,
        patamar_superado: int,
        sequencia_acertos: int,
        diamantes_bonus: int,
        hoje: date,
        limite_diario: int,
        categoria: str,
    ) -> AcertoRegisto | None:
        atual = self.partidas.get(partida_id)
        if atual is None or atual.estado != "em_curso" or atual.pergunta_atual_id != pergunta_id:
            return None
        dia, ganho = self.ganho_sequencias_por_dia.get(utilizador_id, (None, 0))
        ganho_hoje = ganho if dia == hoje else 0
        creditados = max(0, min(diamantes_bonus, limite_diario - ganho_hoje))
        self.ganho_sequencias_por_dia[utilizador_id] = (hoje, ganho_hoje + creditados)
        partida = self._atualizar(
            partida_id,
            lambda p: True,
            patamar_superado=patamar_superado,
            sequencia_acertos=sequencia_acertos,
            diamantes_sequencia=atual.diamantes_sequencia + creditados,
            pergunta_atual_id=None,
            opcao_falhada=None,
        )
        perfil = self._perfis.obter_ou_criar(utilizador_id)
        perfil = replace(
            perfil,
            diamantes=perfil.diamantes + creditados,
            melhor_sequencia=max(perfil.melhor_sequencia, sequencia_acertos),
        )
        self._perfis._perfis[utilizador_id] = perfil
        self._contar(utilizador_id, categoria, certa=True)
        return AcertoRegisto(partida=partida, perfil=perfil, diamantes_creditados=creditados)

    def registar_falha(
        self, partida_id: str, utilizador_id: str, pergunta_id: str, opcao_falhada: str | None, categoria: str
    ) -> PartidaRegisto | None:
        partida = self._atualizar(
            partida_id,
            lambda p: p.estado == "em_curso" and p.pergunta_atual_id == pergunta_id,
            estado="a_aguardar_decisao",
            opcao_falhada=opcao_falhada,
            sequencia_acertos=0,
        )
        if partida is not None:
            self._contar(utilizador_id, categoria, certa=False)
        return partida

    def marcar_ajuda(self, partida_id: str, ajuda: str) -> bool:
        campo = f"{ajuda}_usada"
        return (
            self._atualizar(
                partida_id, lambda p: p.estado == "em_curso" and not getattr(p, campo), **{campo: True}
            )
            is not None
        )

    def usar_vida_extra(self, partida_id: str, utilizador_id: str, custo: int, maximo: int) -> ResultadoVidaExtra:
        atual = self.partidas.get(partida_id)
        if atual is None or atual.estado != "a_aguardar_decisao" or atual.vidas_extra_usadas >= maximo:
            return ResultadoVidaExtra(estado="indisponivel")
        perfil = self._perfis.obter_ou_criar(utilizador_id)
        if perfil.diamantes < custo:
            return ResultadoVidaExtra(estado="saldo_insuficiente")
        partida = self._atualizar(
            partida_id, lambda p: True, estado="em_curso", vidas_extra_usadas=atual.vidas_extra_usadas + 1
        )
        perfil = self._perfis.creditar_diamantes(utilizador_id, -custo)
        return ResultadoVidaExtra(estado="ok", partida=partida, perfil=perfil)

    def terminar(self, partida_id: str, utilizador_id: str, moedas: int, diamantes: int) -> PartidaTerminadaRegisto | None:
        partida = self._atualizar(
            partida_id,
            lambda p: p.estado != "terminada",
            estado="terminada",
            moedas_ganhas=moedas,
            diamantes_ganhos=diamantes,
        )
        if partida is None:
            return None
        atual = self._perfis.obter_ou_criar(utilizador_id)
        perfil = replace(
            atual,
            moedas=atual.moedas + moedas,
            diamantes=atual.diamantes + diamantes,
            partidas_jogadas=atual.partidas_jogadas + 1,
            patamar_maximo_alcancado=max(atual.patamar_maximo_alcancado, partida.patamar_superado),
            patamares_superados_total=atual.patamares_superados_total + partida.patamar_superado,
            moedas_ganhas_total=atual.moedas_ganhas_total + moedas,
        )
        self._perfis._perfis[utilizador_id] = perfil
        return PartidaTerminadaRegisto(partida=partida, perfil=perfil)


# Cada pergunta do banco de teste numa categoria diferente, por nível.
CATEGORIA_DO_NIVEL = {1: "anatomia_ocular", 2: "doencas_estrabismo", 3: "ciencia_ocular"}


@pytest.fixture
def perguntas() -> RepositorioPerguntasFalso:
    repo = RepositorioPerguntasFalso()
    # Uma de cada nível, certa "C" -- chega para subir a escada toda.
    for nivel in (1, 2, 3):
        repo.adicionar(f"n{nivel}", "C", nivel_dificuldade=nivel, categoria=CATEGORIA_DO_NIVEL[nivel])
    return repo


@pytest.fixture
def perfis() -> RepositorioPerfisFalso:
    return RepositorioPerfisFalso()


@pytest.fixture
def partidas(perfis) -> RepositorioPartidasFalso:
    return RepositorioPartidasFalso(perfis)


class Relogio:
    def __init__(self) -> None:
        self.agora = datetime(2026, 9, 24, 10, 0, tzinfo=UTC)

    def __call__(self) -> datetime:
        return self.agora


@pytest.fixture
def relogio() -> Relogio:
    return Relogio()


@pytest.fixture
def servico(perguntas, perfis, partidas, relogio) -> JogoService:
    return JogoService(perguntas, perfis, partidas, relogio=relogio)


def _ativa(partidas: RepositorioPartidasFalso, utilizador_id: str = "u-1"):
    return partidas.obter_ativa(utilizador_id)


def _acertar(servico: JogoService, vezes: int = 1, utilizador_id: str = "u-1"):
    resultado = None
    for _ in range(vezes):
        pergunta = servico.nova_pergunta(utilizador_id).pergunta
        resultado = servico.responder(utilizador_id, pergunta.id, "C")
        assert resultado.correta
    return resultado


def _errar(servico: JogoService, utilizador_id: str = "u-1"):
    pergunta = servico.nova_pergunta(utilizador_id).pergunta
    return pergunta, servico.responder(utilizador_id, pergunta.id, "A")


class TestPerguntaDaPartida:
    def test_entrega_a_pergunta_do_nivel_do_proximo_patamar(self, servico, partidas) -> None:
        primeira = servico.nova_pergunta("u-1")
        assert (primeira.patamar, primeira.pergunta.nivel_dificuldade) == (1, 1)
        assert _ativa(partidas).pergunta_atual_id == primeira.pergunta.id

        servico.responder("u-1", primeira.pergunta.id, "C")
        _acertar(servico, 4)  # patamares 1-5 superados -> o 6 é nível 2
        sexta = servico.nova_pergunta("u-1")
        assert (sexta.patamar, sexta.pergunta.nivel_dificuldade) == (6, 2)

    def test_responder_a_uma_pergunta_que_a_partida_nao_entregou_e_recusado(self, servico, perguntas, partidas) -> None:
        # O oráculo que isto fecha: validar um id qualquer para descobrir a
        # resposta e depois responder "a sério".
        perguntas.adicionar("outra", "B", nivel_dificuldade=1)
        servico.nova_pergunta("u-1")
        with pytest.raises(PerguntaForaDaPartidaError):
            servico.responder("u-1", "outra", "B")
        with pytest.raises(PerguntaForaDaPartidaError):
            servico.esgotar_tempo("u-1", "outra")
        with pytest.raises(PerguntaForaDaPartidaError):
            servico.cinquenta_cinquenta("u-1", "outra")
        assert _ativa(partidas).patamar_superado == 0

    def test_sem_partida_nao_se_valida_nada(self, servico) -> None:
        with pytest.raises(PerguntaForaDaPartidaError):
            servico.responder("u-1", "n1", "C")

    def test_a_mesma_pergunta_nao_conta_duas_vezes(self, servico, partidas) -> None:
        pergunta = servico.nova_pergunta("u-1").pergunta
        servico.responder("u-1", pergunta.id, "C")
        with pytest.raises(PerguntaForaDaPartidaError):
            servico.responder("u-1", pergunta.id, "C")
        assert _ativa(partidas).patamar_superado == 1

    def test_pedir_outra_antes_de_responder_gasta_o_trocar_pergunta(self, servico, perguntas, partidas) -> None:
        perguntas.adicionar("n1-b", "C", nivel_dificuldade=1)
        primeira = servico.nova_pergunta("u-1").pergunta
        segunda = servico.nova_pergunta("u-1").pergunta
        assert segunda.id != primeira.id
        assert _ativa(partidas).trocar_pergunta_usada is True
        with pytest.raises(AjudaJaUsadaError):
            servico.nova_pergunta("u-1")
        # A pergunta trocada já não se pode responder.
        with pytest.raises(PerguntaForaDaPartidaError):
            servico.responder("u-1", primeira.id, "C")

    def test_pedir_a_seguinte_depois_de_acertar_nao_e_troca(self, servico, partidas) -> None:
        _acertar(servico, 3)
        assert _ativa(partidas).trocar_pergunta_usada is False

    def test_sem_perguntas_no_nivel(self, servico, perguntas) -> None:
        perguntas._perguntas.clear()
        with pytest.raises(SemPerguntasError):
            servico.nova_pergunta("u-1")

    def test_depois_do_patamar_15_nao_ha_mais_perguntas(self, servico, partidas) -> None:
        _acertar(servico, 15)
        assert _ativa(partidas).patamar_superado == 15
        with pytest.raises(PartidaCompletaError):
            servico.nova_pergunta("u-1")


class TestSequencias:
    @pytest.mark.parametrize(
        ("sequencia", "diamantes"),
        [(0, 0), (1, 0), (2, 0), (3, 10), (4, 0), (5, 0), (6, 20), (9, 30), (12, 40), (15, 50)],
    )
    def test_marcos_de_3_em_3(self, sequencia, diamantes) -> None:
        assert recompensa_sequencia(sequencia) == diamantes

    def test_ao_terceiro_acerto_seguido_credita_10_diamantes(self, servico, perfis) -> None:
        segundo = _acertar(servico, 2)
        assert segundo.recompensa_sequencia is None and segundo.sequencia_acertos == 2

        terceiro = _acertar(servico)

        assert terceiro.sequencia_acertos == 3
        assert terceiro.recompensa_sequencia.diamantes == 10
        assert terceiro.recompensa_sequencia.perfil.diamantes == 10
        assert perfis.obter_ou_criar("u-1").diamantes == 10

    def test_uma_partida_perfeita_para_no_limite_diario(self, servico, perfis, partidas) -> None:
        # 10 + 20 + 30 = 60 esgota o limite; os marcos de 12 e 15 celebram-se
        # mas não creditam.
        resultados = [_acertar(servico) for _ in range(15)]
        marcos = [r.recompensa_sequencia for r in resultados if r.recompensa_sequencia]
        assert [(m.sequencia, m.diamantes, m.diamantes_do_marco, m.limite_diario_atingido) for m in marcos] == [
            (3, 10, 10, False),
            (6, 20, 20, False),
            (9, 30, 30, False),
            (12, 0, 40, True),
            (15, 0, 50, True),
        ]
        assert perfis.obter_ou_criar("u-1").diamantes == LIMITE_DIARIO_DIAMANTES_SEQUENCIA == 60
        assert _ativa(partidas).diamantes_sequencia == 60
        assert perfis.obter_ou_criar("u-1").melhor_sequencia == 15

    def test_errar_quebra_a_sequencia_mesmo_com_vida_extra(self, servico, perfis, partidas) -> None:
        perfis.creditar_diamantes("u-1", 100)
        _acertar(servico, 2)
        pergunta, _ = _errar(servico)
        servico.usar_vida_extra("u-1")
        assert _ativa(partidas).sequencia_acertos == 0

        # Recomeça do zero: só ao 3.º acerto seguido volta a haver bónus.
        servico.responder("u-1", pergunta.id, "C")
        assert _acertar(servico).recompensa_sequencia is None
        assert _acertar(servico).recompensa_sequencia.diamantes == 10

    def test_os_diamantes_da_sequencia_ficam_mesmo_perdendo_a_partida(self, servico, perfis) -> None:
        _acertar(servico, 3)
        _errar(servico)
        servico.terminar_partida("u-1")
        assert perfis.obter_ou_criar("u-1").diamantes == 10  # 3 patamares não chegam ao marco do 5

    def test_recorde_de_sequencia_nao_desce(self, servico, perfis) -> None:
        _acertar(servico, 4)
        servico.iniciar_partida("u-1")
        _acertar(servico, 2)
        assert perfis.obter_ou_criar("u-1").melhor_sequencia == 4


class TestErrarEVidaExtra:
    def test_errar_nao_revela_a_resposta_e_oferece_vida_extra(self, servico, partidas) -> None:
        _acertar(servico, 3)
        _, resultado = _errar(servico)

        assert resultado.correta is False
        # Revelar aqui tornava a segunda tentativa (paga) uma formalidade.
        assert resultado.resposta_correta is None and resultado.explicacao is None
        assert resultado.vida_extra.custo == CUSTO_VIDA_EXTRA
        assert resultado.vida_extra.restantes == MAXIMO_VIDAS_EXTRA_POR_PARTIDA
        partida = _ativa(partidas)
        assert partida.estado == "a_aguardar_decisao"
        assert partida.patamar_superado == 3  # o progresso não se perde ao errar
        assert partida.opcao_falhada == "A"

    def test_tempo_esgotado_conta_como_falha(self, servico, partidas) -> None:
        pergunta = servico.nova_pergunta("u-1").pergunta
        resultado = servico.esgotar_tempo("u-1", pergunta.id)
        assert resultado.correta is False
        partida = _ativa(partidas)
        assert partida.estado == "a_aguardar_decisao" and partida.opcao_falhada is None

    def test_a_aguardar_decisao_nao_se_responde_nem_se_pede_pergunta(self, servico) -> None:
        pergunta, _ = _errar(servico)
        with pytest.raises(PartidaADecidirError):
            servico.responder("u-1", pergunta.id, "C")
        with pytest.raises(PartidaADecidirError):
            servico.nova_pergunta("u-1")

    def test_usar_vida_extra_devolve_a_mesma_pergunta_sem_a_opcao_falhada(self, servico, perfis, partidas) -> None:
        perfis.creditar_diamantes("u-1", 50)
        _acertar(servico, 1)
        pergunta, _ = _errar(servico)

        usada = servico.usar_vida_extra("u-1")

        assert usada.perfil.diamantes == 50 - CUSTO_VIDA_EXTRA
        assert (usada.pergunta_id, usada.opcao_falhada) == (pergunta.id, "A")
        assert usada.vidas_restantes == MAXIMO_VIDAS_EXTRA_POR_PARTIDA - 1
        assert servico.responder("u-1", pergunta.id, "C").correta is True
        assert _ativa(partidas).patamar_superado == 2

    def test_sem_diamantes_recusa_sem_debitar(self, servico, perfis, partidas) -> None:
        perfis.creditar_diamantes("u-1", CUSTO_VIDA_EXTRA - 1)
        _errar(servico)
        with pytest.raises(DiamantesInsuficientesError):
            servico.usar_vida_extra("u-1")
        assert perfis.obter_ou_criar("u-1").diamantes == CUSTO_VIDA_EXTRA - 1
        assert _ativa(partidas).estado == "a_aguardar_decisao"

    def test_limite_de_vidas_extra_por_partida(self, servico, perfis) -> None:
        perfis.creditar_diamantes("u-1", 1000)
        for _ in range(MAXIMO_VIDAS_EXTRA_POR_PARTIDA):
            pergunta, _ = _errar(servico)
            servico.usar_vida_extra("u-1")
            servico.responder("u-1", pergunta.id, "C")

        _, resultado = _errar(servico)
        assert resultado.vida_extra.restantes == 0
        with pytest.raises(VidaExtraIndisponivelError):
            servico.usar_vida_extra("u-1")

    def test_vida_extra_sem_ter_errado_e_recusada(self, servico, perfis) -> None:
        perfis.creditar_diamantes("u-1", 100)
        with pytest.raises(VidaExtraIndisponivelError):
            servico.usar_vida_extra("u-1")
        servico.nova_pergunta("u-1")
        with pytest.raises(VidaExtraIndisponivelError):
            servico.usar_vida_extra("u-1")
        assert perfis.obter_ou_criar("u-1").diamantes == 100


class TestTerminar:
    def test_recusar_a_vida_extra_paga_os_patamares_e_revela_a_resposta(self, servico) -> None:
        _acertar(servico, 6)
        _errar(servico)

        terminada = servico.terminar_partida("u-1")

        assert (terminada.moedas_ganhas, terminada.diamantes_ganhos) == (6 * 50, 1)
        assert terminada.perfil.moedas == 300 and terminada.perfil.partidas_jogadas == 1
        assert (terminada.resposta_correta, terminada.explicacao) == ("C", "explicação")

    def test_vitoria_paga_o_premio_maximo(self, servico) -> None:
        _acertar(servico, 15)
        terminada = servico.terminar_partida("u-1")
        assert (terminada.moedas_ganhas, terminada.diamantes_ganhos) == (750, 5)
        assert terminada.resposta_correta is None

    def test_terminar_sem_partida_nao_paga_nada(self, servico) -> None:
        terminada = servico.terminar_partida("u-1")
        assert (terminada.moedas_ganhas, terminada.diamantes_ganhos) == (0, 0)
        assert terminada.perfil.partidas_jogadas == 0

    def test_nunca_paga_a_mesma_partida_duas_vezes(self, servico) -> None:
        _acertar(servico, 5)
        servico.terminar_partida("u-1")
        segunda = servico.terminar_partida("u-1")
        assert segunda.moedas_ganhas == 0 and segunda.perfil.partidas_jogadas == 1

    def test_iniciar_outra_partida_termina_a_anterior(self, servico, perfis, partidas) -> None:
        _acertar(servico, 2)
        nova = servico.iniciar_partida("u-1")
        assert nova.patamar_superado == 0 and nova.sequencia_acertos == 0
        assert perfis.obter_ou_criar("u-1").moedas == 100
        assert len(partidas.partidas) == 2


class TestAjudasGratis:
    @pytest.mark.parametrize("correta", ["A", "B", "C", "D"])
    def test_cinquenta_cinquenta_esconde_duas_erradas_e_nunca_a_certa(self, servico, perguntas, correta) -> None:
        perguntas._perguntas.clear()
        perguntas.adicionar("p1", correta, nivel_dificuldade=1)
        servico.nova_pergunta("u-1")
        eliminadas = servico.cinquenta_cinquenta("u-1", "p1")
        assert len(set(eliminadas)) == 2 and correta not in eliminadas

    @pytest.mark.parametrize("correta", ["A", "B", "C", "D"])
    def test_opiniao_publico_favorece_a_certa_e_soma_100(self, servico, perguntas, correta) -> None:
        perguntas._perguntas.clear()
        perguntas.adicionar(f"p-{correta}", correta, nivel_dificuldade=1)
        servico.nova_pergunta("u-1")
        percentagens = servico.opiniao_publico("u-1", f"p-{correta}")
        assert set(percentagens) == {"A", "B", "C", "D"}
        assert sum(percentagens.values()) == 100
        assert 55 <= percentagens[correta] <= 75
        assert all(v >= 1 for v in percentagens.values())

    def test_resultado_e_determinista_por_pergunta(self, servico, perguntas) -> None:
        # Em partidas diferentes, a mesma pergunta dá sempre o mesmo 50:50 --
        # repetir nunca revela mais do que a primeira vez.
        resultados = set()
        for _ in range(5):
            servico.iniciar_partida("u-1")
            pergunta = servico.nova_pergunta("u-1").pergunta
            resultados.add(tuple(servico.cinquenta_cinquenta("u-1", pergunta.id)))
        assert len(resultados) == 1

    def test_ajudas_nunca_mexem_no_progresso(self, servico, partidas) -> None:
        _acertar(servico, 3)
        pergunta = servico.nova_pergunta("u-1").pergunta
        servico.cinquenta_cinquenta("u-1", pergunta.id)
        servico.opiniao_publico("u-1", pergunta.id)
        partida = _ativa(partidas)
        assert partida.patamar_superado == 3 and partida.estado == "em_curso"
        assert partida.sequencia_acertos == 3

    def test_cada_ajuda_so_uma_vez_por_partida(self, servico) -> None:
        pergunta = servico.nova_pergunta("u-1").pergunta
        servico.cinquenta_cinquenta("u-1", pergunta.id)
        servico.opiniao_publico("u-1", pergunta.id)
        with pytest.raises(AjudaJaUsadaError):
            servico.cinquenta_cinquenta("u-1", pergunta.id)
        with pytest.raises(AjudaJaUsadaError):
            servico.opiniao_publico("u-1", pergunta.id)

    def test_nova_partida_volta_a_ter_as_ajudas(self, servico) -> None:
        pergunta = servico.nova_pergunta("u-1").pergunta
        servico.cinquenta_cinquenta("u-1", pergunta.id)
        servico.iniciar_partida("u-1")
        pergunta = servico.nova_pergunta("u-1").pergunta
        assert len(servico.cinquenta_cinquenta("u-1", pergunta.id)) == 2

    def test_ajudas_bloqueadas_a_aguardar_decisao(self, servico) -> None:
        pergunta, _ = _errar(servico)
        with pytest.raises(PartidaADecidirError):
            servico.cinquenta_cinquenta("u-1", pergunta.id)


class TestLimiteDiarioDeSequencias:
    def _partida_de_3(self, servico):
        servico.iniciar_partida("u-1")
        return _acertar(servico, 3).recompensa_sequencia

    def test_recomecar_partidas_para_nos_60_por_dia(self, servico, perfis) -> None:
        # O abuso que o limite trava: recomeçar e acertar 3 fáceis, sem fim.
        ganhos = [self._partida_de_3(servico).diamantes for _ in range(8)]
        assert ganhos == [10, 10, 10, 10, 10, 10, 0, 0]
        assert perfis.obter_ou_criar("u-1").diamantes == 60

    def test_credito_parcial_quando_o_marco_passa_o_limite(self, servico, perfis) -> None:
        for _ in range(4):
            self._partida_de_3(servico)  # 40 ganhos hoje
        servico.iniciar_partida("u-1")
        _acertar(servico, 5)  # marco dos 3: +10 -> 50 hoje
        sexto = _acertar(servico).recompensa_sequencia  # marco de 20, só cabem 10
        assert (sexto.diamantes, sexto.diamantes_do_marco, sexto.limite_diario_atingido) == (10, 20, True)
        assert perfis.obter_ou_criar("u-1").diamantes == 60

    def test_no_limite_o_marco_continua_a_ser_celebrado(self, servico) -> None:
        for _ in range(6):
            self._partida_de_3(servico)
        marco = self._partida_de_3(servico)
        assert marco is not None
        assert (marco.sequencia, marco.diamantes, marco.limite_diario_atingido) == (3, 0, True)

    def test_no_dia_seguinte_utc_o_limite_recomeca(self, servico, perfis, relogio) -> None:
        for _ in range(6):
            self._partida_de_3(servico)
        assert self._partida_de_3(servico).diamantes == 0

        relogio.agora = datetime(2026, 9, 25, 0, 0, 1, tzinfo=UTC)  # 00:00:01 UTC
        assert self._partida_de_3(servico).diamantes == 10
        assert perfis.obter_ou_criar("u-1").diamantes == 70

    def test_o_dia_conta_em_utc_mesmo_com_relogio_noutro_fuso(self, servico, relogio) -> None:
        for _ in range(6):
            self._partida_de_3(servico)
        # 00:30 em Luanda (UTC+1) ainda é 23:30 do dia anterior em UTC.
        luanda = timezone_luanda()
        relogio.agora = datetime(2026, 9, 25, 0, 30, tzinfo=luanda)
        assert self._partida_de_3(servico).diamantes == 0
        relogio.agora = datetime(2026, 9, 24, 23, 0, tzinfo=UTC) + timedelta(hours=1, minutes=1)
        assert self._partida_de_3(servico).diamantes == 10

    def test_o_limite_e_por_jogador(self, servico, perfis) -> None:
        for _ in range(6):
            self._partida_de_3(servico)
        servico.iniciar_partida("u-2")
        assert _acertar(servico, 3, utilizador_id="u-2").recompensa_sequencia.diamantes == 10


def timezone_luanda():
    from datetime import timezone

    return timezone(timedelta(hours=1))


class TestEstatisticasPorCategoria:
    def test_acertos_e_erros_contam_na_categoria_da_pergunta(self, servico, partidas) -> None:
        _acertar(servico, 2)  # 2 certas em anatomia (nível 1)
        _errar(servico)  # 1 errada em anatomia
        assert partidas.estatisticas[("u-1", "anatomia_ocular")] == [3, 2]

    def test_tempo_esgotado_conta_como_resposta_errada(self, servico, partidas) -> None:
        pergunta = servico.nova_pergunta("u-1").pergunta
        servico.esgotar_tempo("u-1", pergunta.id)
        assert partidas.estatisticas[("u-1", "anatomia_ocular")] == [1, 0]

    def test_categorias_diferentes_por_nivel(self, servico, partidas) -> None:
        _acertar(servico, 6)  # 5 de nível 1 + 1 de nível 2
        assert partidas.estatisticas[("u-1", "anatomia_ocular")] == [5, 5]
        assert partidas.estatisticas[("u-1", "doencas_estrabismo")] == [1, 1]

    def test_uma_resposta_recusada_nao_conta(self, servico, perguntas, partidas) -> None:
        perguntas.adicionar("outra", "B", nivel_dificuldade=1, categoria="ciencia_ocular")
        servico.nova_pergunta("u-1")
        with pytest.raises(PerguntaForaDaPartidaError):
            servico.responder("u-1", "outra", "B")
        assert ("u-1", "ciencia_ocular") not in partidas.estatisticas

    def test_terminar_soma_patamares_e_moedas_aos_totais(self, servico, perfis) -> None:
        _acertar(servico, 4)
        servico.terminar_partida("u-1")
        servico.iniciar_partida("u-1")
        _acertar(servico, 2)
        servico.terminar_partida("u-1")
        perfil = perfis.obter_ou_criar("u-1")
        assert perfil.patamares_superados_total == 6
        assert perfil.moedas_ganhas_total == 6 * 50
