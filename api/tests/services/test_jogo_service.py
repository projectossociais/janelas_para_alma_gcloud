"""Testes do `JogoService` -- a mentira que este serviço existe para
impedir: um utilizador a reclamar uma recompensa maior do que o patamar que
realmente alcançou, respondendo perguntas correctamente no servidor."""

from dataclasses import replace

import pytest

from app.repositories.jogo_repository import PerguntaJogoRegisto
from app.repositories.partida_jogo_repository import (
    PartidaRegisto,
    PartidaTerminadaRegisto,
    ResultadoVidaExtra,
)
from app.repositories.perfil_jogador_repository import PerfilJogadorRegisto
from app.services.jogo_service import (
    CUSTO_VIDA_EXTRA,
    MAXIMO_VIDAS_EXTRA_POR_PARTIDA,
    AjudaJaUsadaError,
    DiamantesInsuficientesError,
    JogoService,
    PartidaADecidirError,
    PerguntaNaoEncontradaError,
    VidaExtraIndisponivelError,
)


class RepositorioPerguntasFalso:
    def __init__(self) -> None:
        self._perguntas: dict[str, PerguntaJogoRegisto] = {}

    def adicionar(self, pergunta_id: str, resposta_correta: str, nivel_dificuldade: int) -> None:
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
        )

    def obter_aleatoria(self, nivel_dificuldade: int | None = None) -> PerguntaJogoRegisto | None:
        raise NotImplementedError

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
            pergunta_falhada_id=None,
            opcao_falhada=None,
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

    def registar_acerto(self, partida_id: str, patamar_superado: int) -> PartidaRegisto | None:
        return self._atualizar(
            partida_id,
            lambda p: p.estado == "em_curso",
            patamar_superado=patamar_superado,
            pergunta_falhada_id=None,
            opcao_falhada=None,
        )

    def registar_falha(self, partida_id: str, pergunta_id: str, opcao_falhada: str | None) -> PartidaRegisto | None:
        return self._atualizar(
            partida_id,
            lambda p: p.estado == "em_curso",
            estado="a_aguardar_decisao",
            pergunta_falhada_id=pergunta_id,
            opcao_falhada=opcao_falhada,
        )

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
        )
        self._perfis._perfis[utilizador_id] = perfil
        return PartidaTerminadaRegisto(partida=partida, perfil=perfil)


@pytest.fixture
def perguntas() -> RepositorioPerguntasFalso:
    return RepositorioPerguntasFalso()


@pytest.fixture
def perfis() -> RepositorioPerfisFalso:
    return RepositorioPerfisFalso()


@pytest.fixture
def partidas(perfis) -> RepositorioPartidasFalso:
    return RepositorioPartidasFalso(perfis)


@pytest.fixture
def servico(perguntas, perfis, partidas) -> JogoService:
    return JogoService(perguntas, perfis, partidas)


def _patamar(partidas: RepositorioPartidasFalso, utilizador_id: str = "u-1") -> int:
    ativa = partidas.obter_ativa(utilizador_id)
    return ativa.patamar_superado if ativa else 0


def _por_no_patamar(partidas: RepositorioPartidasFalso, patamar: int, utilizador_id: str = "u-1") -> None:
    partida = partidas.criar(utilizador_id)
    partidas.partidas[partida.id] = replace(partida, patamar_superado=patamar)


class TestResponder:
    def test_pergunta_inexistente_levanta_erro(self, servico) -> None:
        with pytest.raises(PerguntaNaoEncontradaError):
            servico.responder("u-1", "nao-existe", "A")

    def test_anonimo_valida_revela_e_nao_cria_nada(self, servico, perguntas, perfis, partidas) -> None:
        perguntas.adicionar("p1", "A", nivel_dificuldade=1)
        errada = servico.responder(None, "p1", "B")
        assert errada.correta is False
        assert errada.resposta_correta == "A"  # sem partida, revela logo
        assert errada.vida_extra is None
        assert perfis._perfis == {} and partidas.partidas == {}

    def test_resposta_certa_no_nivel_esperado_avanca_o_patamar(self, servico, perguntas, partidas) -> None:
        perguntas.adicionar("p1", "A", nivel_dificuldade=1)  # nível 1 == patamares 1-5
        servico.iniciar_partida("u-1")
        resultado = servico.responder("u-1", "p1", "A")
        assert resultado.correta is True
        assert _patamar(partidas) == 1

    def test_sem_partida_iniciada_cria_uma_ao_responder(self, servico, perguntas, partidas) -> None:
        # Se o pedido de início falhou na rede, o jogador não perde o progresso.
        perguntas.adicionar("p1", "A", nivel_dificuldade=1)
        servico.responder("u-1", "p1", "A")
        assert _patamar(partidas) == 1

    def test_resposta_certa_de_nivel_errado_nao_avanca_o_patamar(self, servico, perguntas, partidas) -> None:
        # Reutilizar uma pergunta fácil (nível 1) depois do patamar 5 (nível 2
        # esperado) não inflaciona o progresso.
        perguntas.adicionar("facil", "A", nivel_dificuldade=1)
        _por_no_patamar(partidas, 5)
        resultado = servico.responder("u-1", "facil", "A")
        assert resultado.correta is True
        assert _patamar(partidas) == 5

    def test_nunca_passa_do_patamar_15(self, servico, perguntas, partidas) -> None:
        perguntas.adicionar("dificil", "A", nivel_dificuldade=3)
        _por_no_patamar(partidas, 15)
        servico.responder("u-1", "dificil", "A")
        assert _patamar(partidas) == 15


class TestErrarEVidaExtra:
    def test_errar_nao_revela_a_resposta_e_oferece_vida_extra(self, servico, perguntas, partidas) -> None:
        perguntas.adicionar("p1", "C", nivel_dificuldade=1)
        _por_no_patamar(partidas, 3)

        resultado = servico.responder("u-1", "p1", "A")

        assert resultado.correta is False
        # Revelar aqui tornava a segunda tentativa (paga) uma formalidade.
        assert resultado.resposta_correta is None
        assert resultado.explicacao is None
        assert resultado.vida_extra.custo == CUSTO_VIDA_EXTRA
        assert resultado.vida_extra.restantes == MAXIMO_VIDAS_EXTRA_POR_PARTIDA
        partida = partidas.obter_ativa("u-1")
        assert partida.estado == "a_aguardar_decisao"
        assert partida.patamar_superado == 3  # o progresso não se perde ao errar
        assert (partida.pergunta_falhada_id, partida.opcao_falhada) == ("p1", "A")

    def test_tempo_esgotado_conta_como_falha_mesmo_que_a_seria_a_certa(self, servico, perguntas, partidas) -> None:
        # Bug reproduzido: o cliente mandava "A" ao esgotar o tempo; se "A"
        # fosse a certa, o progresso avançava sem resposta nenhuma.
        perguntas.adicionar("p1", "A", nivel_dificuldade=1)
        servico.iniciar_partida("u-1")
        resultado = servico.esgotar_tempo("u-1", "p1")
        assert resultado.correta is False
        partida = partidas.obter_ativa("u-1")
        assert partida.estado == "a_aguardar_decisao"
        assert partida.patamar_superado == 0
        assert partida.opcao_falhada is None

    def test_tempo_esgotado_anonimo_revela_e_nao_cria_nada(self, servico, perguntas, perfis, partidas) -> None:
        perguntas.adicionar("p1", "B", nivel_dificuldade=1)
        resultado = servico.esgotar_tempo(None, "p1")
        assert resultado.resposta_correta == "B"
        assert perfis._perfis == {} and partidas.partidas == {}

    def test_a_aguardar_decisao_nao_se_responde_a_mais_nada(self, servico, perguntas, partidas) -> None:
        perguntas.adicionar("p1", "C", nivel_dificuldade=1)
        perguntas.adicionar("p2", "A", nivel_dificuldade=1)
        servico.iniciar_partida("u-1")
        servico.responder("u-1", "p1", "A")
        with pytest.raises(PartidaADecidirError):
            servico.responder("u-1", "p2", "A")
        with pytest.raises(PartidaADecidirError):
            servico.esgotar_tempo("u-1", "p2")

    def test_usar_vida_extra_debita_e_devolve_a_mesma_pergunta_sem_a_opcao_falhada(
        self, servico, perguntas, perfis, partidas
    ) -> None:
        perguntas.adicionar("p1", "C", nivel_dificuldade=1)
        perfis.creditar_diamantes("u-1", 50)
        _por_no_patamar(partidas, 4)
        servico.responder("u-1", "p1", "A")

        usada = servico.usar_vida_extra("u-1")

        assert usada.perfil.diamantes == 50 - CUSTO_VIDA_EXTRA
        assert (usada.pergunta_id, usada.opcao_falhada) == ("p1", "A")
        assert usada.vidas_restantes == MAXIMO_VIDAS_EXTRA_POR_PARTIDA - 1
        partida = partidas.obter_ativa("u-1")
        assert partida.estado == "em_curso" and partida.patamar_superado == 4

    def test_depois_da_vida_extra_acertar_continua_a_subir(self, servico, perguntas, perfis, partidas) -> None:
        perguntas.adicionar("p1", "C", nivel_dificuldade=1)
        perfis.creditar_diamantes("u-1", 50)
        _por_no_patamar(partidas, 4)
        servico.responder("u-1", "p1", "A")
        servico.usar_vida_extra("u-1")

        assert servico.responder("u-1", "p1", "C").correta is True
        assert _patamar(partidas) == 5

    def test_sem_diamantes_recusa_sem_debitar_e_a_partida_continua_a_aguardar(
        self, servico, perguntas, perfis, partidas
    ) -> None:
        perguntas.adicionar("p1", "C", nivel_dificuldade=1)
        perfis.creditar_diamantes("u-1", CUSTO_VIDA_EXTRA - 1)
        servico.iniciar_partida("u-1")
        servico.responder("u-1", "p1", "A")

        with pytest.raises(DiamantesInsuficientesError):
            servico.usar_vida_extra("u-1")

        assert perfis.obter_ou_criar("u-1").diamantes == CUSTO_VIDA_EXTRA - 1
        partida = partidas.obter_ativa("u-1")
        assert partida.estado == "a_aguardar_decisao" and partida.vidas_extra_usadas == 0

    def test_limite_de_vidas_extra_por_partida(self, servico, perguntas, perfis, partidas) -> None:
        perguntas.adicionar("p1", "C", nivel_dificuldade=1)
        perfis.creditar_diamantes("u-1", 1000)
        servico.iniciar_partida("u-1")
        for _ in range(MAXIMO_VIDAS_EXTRA_POR_PARTIDA):
            servico.responder("u-1", "p1", "A")
            servico.usar_vida_extra("u-1")

        resultado = servico.responder("u-1", "p1", "A")
        assert resultado.vida_extra.restantes == 0
        with pytest.raises(VidaExtraIndisponivelError):
            servico.usar_vida_extra("u-1")
        assert perfis.obter_ou_criar("u-1").diamantes == 1000 - MAXIMO_VIDAS_EXTRA_POR_PARTIDA * CUSTO_VIDA_EXTRA

    def test_vida_extra_sem_ter_errado_e_recusada(self, servico, perfis) -> None:
        perfis.creditar_diamantes("u-1", 100)
        with pytest.raises(VidaExtraIndisponivelError):
            servico.usar_vida_extra("u-1")  # sem partida
        servico.iniciar_partida("u-1")
        with pytest.raises(VidaExtraIndisponivelError):
            servico.usar_vida_extra("u-1")  # em curso, não errou
        assert perfis.obter_ou_criar("u-1").diamantes == 100

    def test_a_mesma_falha_nao_paga_duas_vidas(self, servico, perguntas, perfis, partidas) -> None:
        perguntas.adicionar("p1", "C", nivel_dificuldade=1)
        perfis.creditar_diamantes("u-1", 100)
        servico.iniciar_partida("u-1")
        servico.responder("u-1", "p1", "A")
        servico.usar_vida_extra("u-1")
        with pytest.raises(VidaExtraIndisponivelError):
            servico.usar_vida_extra("u-1")
        assert perfis.obter_ou_criar("u-1").diamantes == 100 - CUSTO_VIDA_EXTRA


class TestTerminar:
    def test_recusar_a_vida_extra_paga_os_patamares_superados_e_revela_a_resposta(
        self, servico, perguntas, partidas
    ) -> None:
        # Bug corrigido: o servidor zerava o progresso ao errar e pagava 0
        # numa derrota, apesar de o ecrã mostrar o prémio dos patamares.
        perguntas.adicionar("p1", "C", nivel_dificuldade=2)
        _por_no_patamar(partidas, 6)
        servico.responder("u-1", "p1", "A")

        terminada = servico.terminar_partida("u-1")

        assert (terminada.moedas_ganhas, terminada.diamantes_ganhos) == (6 * 50, 1)
        assert terminada.perfil.moedas == 300 and terminada.perfil.partidas_jogadas == 1
        assert terminada.perfil.patamar_maximo_alcancado == 6
        assert (terminada.resposta_correta, terminada.explicacao) == ("C", "explicação")
        assert partidas.obter_ativa("u-1") is None

    def test_vitoria_paga_o_premio_maximo(self, servico, partidas) -> None:
        _por_no_patamar(partidas, 15)
        terminada = servico.terminar_partida("u-1")
        assert (terminada.moedas_ganhas, terminada.diamantes_ganhos) == (750, 5)
        assert terminada.resposta_correta is None

    def test_terminar_sem_partida_nao_paga_nada(self, servico) -> None:
        # O ataque original: chamar o prémio directamente, sem jogar.
        terminada = servico.terminar_partida("u-1")
        assert (terminada.moedas_ganhas, terminada.diamantes_ganhos) == (0, 0)
        assert terminada.perfil.moedas == 0 and terminada.perfil.partidas_jogadas == 0

    def test_nunca_paga_a_mesma_partida_duas_vezes(self, servico, partidas) -> None:
        _por_no_patamar(partidas, 5)
        servico.terminar_partida("u-1")
        segunda = servico.terminar_partida("u-1")
        assert segunda.moedas_ganhas == 0
        assert segunda.perfil.moedas == 250 and segunda.perfil.partidas_jogadas == 1

    def test_iniciar_outra_partida_termina_a_anterior_pagando_o_que_tinha(self, servico, perfis, partidas) -> None:
        _por_no_patamar(partidas, 2)
        nova = servico.iniciar_partida("u-1")
        assert nova.patamar_superado == 0 and nova.estado == "em_curso"
        assert perfis.obter_ou_criar("u-1").moedas == 100
        assert len(partidas.partidas) == 2


class TestAjudasGratis:
    @pytest.mark.parametrize("correta", ["A", "B", "C", "D"])
    def test_cinquenta_cinquenta_esconde_duas_erradas_e_nunca_a_certa(self, servico, perguntas, correta) -> None:
        perguntas.adicionar("p1", correta, nivel_dificuldade=1)
        eliminadas = servico.cinquenta_cinquenta(None, "p1")
        assert len(eliminadas) == 2
        assert correta not in eliminadas
        assert len(set(eliminadas)) == 2

    def test_cinquenta_cinquenta_e_determinista_por_pergunta(self, servico, perguntas) -> None:
        # Repetir o pedido nunca pode revelar mais do que a primeira vez.
        perguntas.adicionar("p1", "C", nivel_dificuldade=1)
        assert {tuple(servico.cinquenta_cinquenta(None, "p1")) for _ in range(20)} == {
            tuple(servico.cinquenta_cinquenta(None, "p1"))
        }

    @pytest.mark.parametrize("correta", ["A", "B", "C", "D"])
    def test_opiniao_publico_favorece_a_certa_e_soma_100(self, servico, perguntas, correta) -> None:
        perguntas.adicionar(f"p-{correta}", correta, nivel_dificuldade=1)
        percentagens = servico.opiniao_publico(None, f"p-{correta}")
        assert set(percentagens) == {"A", "B", "C", "D"}
        assert sum(percentagens.values()) == 100
        assert 55 <= percentagens[correta] <= 75
        assert all(v >= 1 for v in percentagens.values())
        assert percentagens[correta] == max(percentagens.values())

    def test_opiniao_publico_e_determinista_por_pergunta(self, servico, perguntas) -> None:
        perguntas.adicionar("p1", "D", nivel_dificuldade=1)
        assert all(servico.opiniao_publico(None, "p1") == servico.opiniao_publico(None, "p1") for _ in range(10))

    def test_ajudas_nunca_mexem_no_progresso(self, servico, perguntas, partidas) -> None:
        # Bug corrigido: as ajudas chamavam `responder` com "A" e zeravam o
        # progresso sempre que "A" estava errada.
        perguntas.adicionar("p1", "B", nivel_dificuldade=1)
        _por_no_patamar(partidas, 3)
        servico.cinquenta_cinquenta("u-1", "p1")
        servico.opiniao_publico("u-1", "p1")
        partida = partidas.obter_ativa("u-1")
        assert partida.patamar_superado == 3 and partida.estado == "em_curso"

    def test_cada_ajuda_so_uma_vez_por_partida(self, servico, perguntas) -> None:
        perguntas.adicionar("p1", "B", nivel_dificuldade=1)
        servico.iniciar_partida("u-1")
        servico.cinquenta_cinquenta("u-1", "p1")
        servico.opiniao_publico("u-1", "p1")
        with pytest.raises(AjudaJaUsadaError):
            servico.cinquenta_cinquenta("u-1", "p1")
        with pytest.raises(AjudaJaUsadaError):
            servico.opiniao_publico("u-1", "p1")

    def test_nova_partida_volta_a_ter_as_ajudas(self, servico, perguntas) -> None:
        perguntas.adicionar("p1", "B", nivel_dificuldade=1)
        servico.iniciar_partida("u-1")
        servico.cinquenta_cinquenta("u-1", "p1")
        servico.iniciar_partida("u-1")
        assert len(servico.cinquenta_cinquenta("u-1", "p1")) == 2

    def test_ajudas_bloqueadas_a_aguardar_decisao(self, servico, perguntas) -> None:
        perguntas.adicionar("p1", "B", nivel_dificuldade=1)
        servico.iniciar_partida("u-1")
        servico.responder("u-1", "p1", "A")
        with pytest.raises(PartidaADecidirError):
            servico.cinquenta_cinquenta("u-1", "p1")

    def test_pergunta_inexistente_nao_gasta_a_ajuda(self, servico, perguntas, partidas) -> None:
        servico.iniciar_partida("u-1")
        with pytest.raises(PerguntaNaoEncontradaError):
            servico.cinquenta_cinquenta("u-1", "nao-existe")
        assert partidas.obter_ativa("u-1").cinquenta_cinquenta_usada is False

    def test_ajuda_com_pergunta_inexistente(self, servico) -> None:
        with pytest.raises(PerguntaNaoEncontradaError):
            servico.cinquenta_cinquenta(None, "nao-existe")
        with pytest.raises(PerguntaNaoEncontradaError):
            servico.opiniao_publico(None, "nao-existe")
