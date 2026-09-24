"""Regras de negócio do jogo "Inclusivamente" (quiz "Você Sabia Que...").

A pergunta de sempre (CLAUDE.md secção 3): "o utilizador podia mentir sobre
isto?" -- sim, sobre quase tudo numa partida: o patamar alcançado, as ajudas
já usadas, as vidas extra, o prémio. Por isso tudo isso vive numa partida
guardada no servidor (`partidas_jogo`, ver `PartidaJogoRepository`):

- O patamar só avança quando `responder` confirma, no servidor, que a
  resposta está certa **e** que a pergunta é do nível esperado para o
  próximo patamar. Antes de 2026-09-23 `POST /jogo/recompensas` aceitava o
  patamar do corpo do pedido; um pedido forjado dava o prémio máximo.
- Ao errar (ou esgotar o tempo), a partida fica `a_aguardar_decisao` e a
  resposta certa **não** é revelada: o jogador pode pagar uma vida extra e
  voltar a tentar a mesma pergunta (sem a opção falhada) -- revelar a
  resposta antes disso tornava a segunda tentativa uma formalidade. A
  resposta só é revelada ao terminar a partida.
- A recompensa paga-se uma única vez, ao terminar (vitória, derrota,
  desistência ou início de outra partida), pelos patamares superados --
  mesma regra que o ecrã final sempre mostrou. Até 2026-09-24 o servidor
  zerava o progresso ao errar e pagava 0 numa derrota, ao contrário do que
  o ecrã dizia.

Sem sessão não há partida: valida-se, revela-se a resposta e mais nada.
"""

import random
from dataclasses import dataclass

from app.repositories.jogo_repository import (
    PerguntaJogoRegisto,
    PerguntaJogoRepository,
    nivel_dificuldade_do_patamar,
)
from app.repositories.partida_jogo_repository import (
    AjudaPartida,
    PartidaJogoRepository,
    PartidaRegisto,
)
from app.repositories.perfil_jogador_repository import (
    PerfilJogadorRegisto,
    PerfilJogadorRepository,
    calcular_recompensa,
)

OPCOES = ("A", "B", "C", "D")

TOTAL_PATAMARES = 15

# Vida extra: custo e limite por partida. Equilíbrio: uma partida boa rende
# dezenas de diamantes (marcos + sequências), o pacote pequeno da loja dá 50.
CUSTO_VIDA_EXTRA = 20
MAXIMO_VIDAS_EXTRA_POR_PARTIDA = 2


class PerguntaNaoEncontradaError(Exception):
    def __init__(self, pergunta_id: str) -> None:
        super().__init__(f"pergunta não encontrada: {pergunta_id}")
        self.pergunta_id = pergunta_id


class PartidaADecidirError(Exception):
    """A partida está à espera da decisão sobre a vida extra -- não se
    responde a mais nada, nem se usam ajudas, até decidir."""


class AjudaJaUsadaError(Exception):
    def __init__(self, ajuda: str) -> None:
        super().__init__(f"ajuda já usada nesta partida: {ajuda}")
        self.ajuda = ajuda


class VidaExtraIndisponivelError(Exception):
    """Sem partida à espera de decisão, ou o limite por partida já foi usado."""


class DiamantesInsuficientesError(Exception):
    def __init__(self, custo: int) -> None:
        super().__init__(f"diamantes insuficientes (custo: {custo})")
        self.custo = custo


@dataclass(frozen=True)
class OfertaVidaExtra:
    custo: int
    restantes: int


@dataclass(frozen=True)
class ResultadoResposta:
    correta: bool
    # `None` quando a partida fica à espera da decisão sobre a vida extra --
    # a resposta certa só se revela ao terminar (ver docstring do módulo).
    resposta_correta: str | None
    explicacao: str | None
    vida_extra: OfertaVidaExtra | None = None


@dataclass(frozen=True)
class VidaExtraUsada:
    perfil: PerfilJogadorRegisto
    pergunta_id: str
    # A opção a esconder na segunda tentativa (`None` se o tempo esgotou).
    opcao_falhada: str | None
    vidas_restantes: int


@dataclass(frozen=True)
class PartidaTerminada:
    perfil: PerfilJogadorRegisto
    patamar_superado: int
    moedas_ganhas: int
    diamantes_ganhos: int
    # Preenchidas quando a partida acabou numa pergunta falhada: a resposta
    # que ficou por revelar em `responder`.
    resposta_correta: str | None
    explicacao: str | None


class JogoService:
    def __init__(
        self,
        perguntas: PerguntaJogoRepository,
        perfis: PerfilJogadorRepository,
        partidas: PartidaJogoRepository,
    ) -> None:
        self._perguntas = perguntas
        self._perfis = perfis
        self._partidas = partidas

    # --- Ciclo de vida da partida --------------------------------------------

    def iniciar_partida(self, utilizador_id: str) -> PartidaRegisto:
        """Começa uma partida nova. Uma que ainda estivesse aberta termina
        primeiro, paga pelo que já tinha superado -- o mesmo que desistir."""
        ativa = self._partidas.obter_ativa(utilizador_id)
        if ativa is not None:
            self._terminar(utilizador_id, ativa)
        return self._partidas.criar(utilizador_id)

    def terminar_partida(self, utilizador_id: str) -> PartidaTerminada:
        """Vitória, derrota (recusou a vida extra) ou desistência. Sem
        partida aberta, não paga nada -- e nunca paga a mesma duas vezes."""
        ativa = self._partidas.obter_ativa(utilizador_id)
        if ativa is None:
            perfil = self._perfis.obter_ou_criar(utilizador_id)
            return PartidaTerminada(perfil, 0, 0, 0, None, None)
        return self._terminar(utilizador_id, ativa)

    def _terminar(self, utilizador_id: str, partida: PartidaRegisto) -> PartidaTerminada:
        self._perfis.obter_ou_criar(utilizador_id)
        moedas, diamantes = calcular_recompensa(partida.patamar_superado)
        terminada = self._partidas.terminar(partida.id, utilizador_id, moedas, diamantes)
        if terminada is None:
            # Outro pedido terminou-a entretanto (e pagou) -- não paga outra vez.
            perfil = self._perfis.obter_ou_criar(utilizador_id)
            return PartidaTerminada(perfil, partida.patamar_superado, 0, 0, None, None)

        resposta_correta = explicacao = None
        if partida.estado == "a_aguardar_decisao" and partida.pergunta_falhada_id:
            pergunta = self._perguntas.obter_por_id(partida.pergunta_falhada_id)
            if pergunta is not None:
                resposta_correta, explicacao = pergunta.resposta_correta, pergunta.explicacao
        return PartidaTerminada(
            perfil=terminada.perfil,
            patamar_superado=partida.patamar_superado,
            moedas_ganhas=moedas,
            diamantes_ganhos=diamantes,
            resposta_correta=resposta_correta,
            explicacao=explicacao,
        )

    def _partida_para_responder(self, utilizador_id: str) -> PartidaRegisto:
        """A partida aberta; cria uma se não houver (ex.: o pedido de início
        falhou na rede) para o jogador não perder o progresso por isso."""
        partida = self._partidas.obter_ativa(utilizador_id) or self._partidas.criar(utilizador_id)
        if partida.estado == "a_aguardar_decisao":
            raise PartidaADecidirError()
        return partida

    # --- Responder -----------------------------------------------------------

    def responder(
        self, utilizador_id: str | None, pergunta_id: str, resposta_usuario: str
    ) -> ResultadoResposta:
        pergunta = self._obter(pergunta_id)
        correta = resposta_usuario == pergunta.resposta_correta

        if utilizador_id is None:
            return ResultadoResposta(correta, pergunta.resposta_correta, pergunta.explicacao)

        partida = self._partida_para_responder(utilizador_id)
        if not correta:
            return self._falhar(partida, pergunta, resposta_usuario)

        proximo_patamar = partida.patamar_superado + 1
        if proximo_patamar <= TOTAL_PATAMARES and pergunta.nivel_dificuldade == nivel_dificuldade_do_patamar(
            proximo_patamar
        ):
            self._partidas.registar_acerto(partida.id, proximo_patamar)
        # Acertou mas a pergunta não era do nível esperado (ex.: um pedido
        # forjado a reutilizar uma pergunta fácil): mostra-se a resposta, mas
        # não conta para o patamar.
        return ResultadoResposta(True, pergunta.resposta_correta, pergunta.explicacao)

    def esgotar_tempo(self, utilizador_id: str | None, pergunta_id: str) -> ResultadoResposta:
        """O tempo acabou sem resposta -- conta sempre como errada. Antes de
        2026-09-24 o cliente enviava "A" a `responder`; quando "A" era a
        certa, o servidor avançava o progresso sem resposta nenhuma."""
        pergunta = self._obter(pergunta_id)
        if utilizador_id is None:
            return ResultadoResposta(False, pergunta.resposta_correta, pergunta.explicacao)
        return self._falhar(self._partida_para_responder(utilizador_id), pergunta, None)

    def _falhar(
        self, partida: PartidaRegisto, pergunta: PerguntaJogoRegisto, opcao: str | None
    ) -> ResultadoResposta:
        atualizada = self._partidas.registar_falha(partida.id, pergunta.id, opcao)
        if atualizada is None:
            raise PartidaADecidirError()
        restantes = max(0, MAXIMO_VIDAS_EXTRA_POR_PARTIDA - atualizada.vidas_extra_usadas)
        return ResultadoResposta(
            correta=False,
            resposta_correta=None,
            explicacao=None,
            vida_extra=OfertaVidaExtra(custo=CUSTO_VIDA_EXTRA, restantes=restantes),
        )

    # --- Vida extra ----------------------------------------------------------

    def usar_vida_extra(self, utilizador_id: str) -> VidaExtraUsada:
        partida = self._partidas.obter_ativa(utilizador_id)
        if (
            partida is None
            or partida.estado != "a_aguardar_decisao"
            or partida.pergunta_falhada_id is None
            or partida.vidas_extra_usadas >= MAXIMO_VIDAS_EXTRA_POR_PARTIDA
        ):
            raise VidaExtraIndisponivelError()
        self._perfis.obter_ou_criar(utilizador_id)
        resultado = self._partidas.usar_vida_extra(
            partida.id, utilizador_id, CUSTO_VIDA_EXTRA, MAXIMO_VIDAS_EXTRA_POR_PARTIDA
        )
        if resultado.estado == "saldo_insuficiente":
            raise DiamantesInsuficientesError(CUSTO_VIDA_EXTRA)
        if resultado.estado != "ok" or resultado.perfil is None or resultado.partida is None:
            raise VidaExtraIndisponivelError()
        return VidaExtraUsada(
            perfil=resultado.perfil,
            pergunta_id=partida.pergunta_falhada_id,
            opcao_falhada=partida.opcao_falhada,
            vidas_restantes=MAXIMO_VIDAS_EXTRA_POR_PARTIDA - resultado.partida.vidas_extra_usadas,
        )

    # --- Ajudas grátis ------------------------------------------------------
    #
    # Antes disto (2026-09-24) o 50:50 e a Opinião do Público chamavam
    # `responder` com "A" para descobrir a resposta certa -- e quando "A"
    # estava errada o servidor punha o progresso a 0, apagando a recompensa
    # da partida. Agora têm endpoints próprios que nunca mexem no progresso.
    #
    # Deterministas por pergunta (semente = id da pergunta): repetir o pedido
    # devolve sempre o mesmo resultado, por isso não dá para somar várias
    # sondagens até a resposta certa sobressair.

    #
    # Com sessão e partida aberta, cada ajuda só se usa uma vez por partida
    # (marcada de forma atómica em `partidas_jogo`).

    def cinquenta_cinquenta(self, utilizador_id: str | None, pergunta_id: str) -> list[str]:
        """Duas opções erradas a esconder, por ordem alfabética."""
        pergunta = self._obter(pergunta_id)
        self._gastar_ajuda(utilizador_id, "cinquenta_cinquenta")
        erradas = [o for o in OPCOES if o != pergunta.resposta_correta]
        return sorted(random.Random(f"5050:{pergunta_id}").sample(erradas, 2))

    def opiniao_publico(self, utilizador_id: str | None, pergunta_id: str) -> dict[str, int]:
        """Sondagem simulada: a certa entre 55% e 75%, o resto repartido
        pelas outras três (nunca 0%), soma sempre 100."""
        pergunta = self._obter(pergunta_id)
        self._gastar_ajuda(utilizador_id, "opiniao_publico")
        gerador = random.Random(f"publico:{pergunta_id}")
        correta = pergunta.resposta_correta
        percentagem_correta = gerador.randint(55, 75)
        restantes = [o for o in OPCOES if o != correta]
        pesos = [gerador.random() + 0.1 for _ in restantes]
        disponivel = 100 - percentagem_correta
        valores = [max(1, round(p / sum(pesos) * disponivel)) for p in pesos]
        # Acerta o arredondamento na maior das erradas, para a soma dar 100.
        maior = valores.index(max(valores))
        valores[maior] += disponivel - sum(valores)
        resultado = {correta: percentagem_correta}
        resultado.update(zip(restantes, valores, strict=True))
        return {o: resultado[o] for o in OPCOES}

    def _gastar_ajuda(self, utilizador_id: str | None, ajuda: AjudaPartida) -> None:
        if utilizador_id is None:
            return
        partida = self._partidas.obter_ativa(utilizador_id)
        if partida is None:
            # Sem partida aberta não há progresso nem prémio a proteger.
            return
        if partida.estado == "a_aguardar_decisao":
            raise PartidaADecidirError()
        if not self._partidas.marcar_ajuda(partida.id, ajuda):
            raise AjudaJaUsadaError(ajuda)

    def _obter(self, pergunta_id: str) -> PerguntaJogoRegisto:
        pergunta = self._perguntas.obter_por_id(pergunta_id)
        if pergunta is None:
            raise PerguntaNaoEncontradaError(pergunta_id)
        return pergunta
