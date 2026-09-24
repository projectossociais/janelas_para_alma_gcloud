"""Regras de negócio do jogo "Inclusivamente" (quiz "Você Sabia Que...").

A pergunta de sempre (CLAUDE.md secção 3): "o utilizador podia mentir sobre
isto?" -- sim, sobre quase tudo numa partida: que pergunta respondeu, o
patamar alcançado, as ajudas já usadas, as vidas extra, as sequências, o
prémio. Por isso tudo isso vive numa partida guardada no servidor
(`partidas_jogo`, ver `PartidaJogoRepository`), e o jogo exige sessão:

- **A pergunta é entregue pela partida** (`nova_pergunta`) e só essa se pode
  validar, ajudar ou comprar no Mercado. Até 2026-09-24 `/jogo/validar`
  aceitava qualquer id de pergunta, sem sessão, e revelava a resposta --
  servia de oráculo para responder depois com sessão e ganhar prémios.
  Quem joga sem conta usa agora só a reserva local do frontend, sem prémio.
- O nível da pergunta sai do patamar da partida, nunca do cliente.
- Ao errar (ou esgotar o tempo), a partida fica `a_aguardar_decisao` e a
  resposta certa **não** é revelada: o jogador pode pagar uma vida extra e
  voltar a tentar a mesma pergunta (sem a opção falhada). A resposta só é
  revelada ao terminar a partida.
- Cada 3 acertos seguidos dão diamantes (`recompensa_sequencia`), creditados
  na mesma transacção que regista o acerto, até
  `LIMITE_DIARIO_DIAMANTES_SEQUENCIA` por dia (UTC) -- sem limite, recomeçar
  partidas e acertar 3 perguntas fáceis era uma fonte infinita de diamantes.
  Atingido o limite, o marco continua a ser celebrado, mas não credita.
- O prémio da partida paga-se uma única vez, ao terminar (vitória, derrota,
  desistência ou início de outra partida), pelos patamares superados.
"""

import random
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime

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

# Sequências de acertos: a cada `ACERTOS_POR_MARCO` seguidos, o marco n
# (1, 2, 3...) dá n x `DIAMANTES_POR_MARCO` -- 3 -> 10, 6 -> 20, 9 -> 30...
ACERTOS_POR_MARCO = 3
DIAMANTES_POR_MARCO = 10
# Teto de diamantes ganhos em sequências por jogador e por dia UTC (decisão
# do dono do projecto, 2026-09-24).
LIMITE_DIARIO_DIAMANTES_SEQUENCIA = 60


def recompensa_sequencia(sequencia_acertos: int) -> int:
    """Diamantes ganhos ao chegar a `sequencia_acertos` acertos seguidos --
    só nos marcos (múltiplos de 3); 0 em todos os outros."""
    if sequencia_acertos <= 0 or sequencia_acertos % ACERTOS_POR_MARCO != 0:
        return 0
    return (sequencia_acertos // ACERTOS_POR_MARCO) * DIAMANTES_POR_MARCO


class PerguntaNaoEncontradaError(Exception):
    def __init__(self, pergunta_id: str) -> None:
        super().__init__(f"pergunta não encontrada: {pergunta_id}")
        self.pergunta_id = pergunta_id


class SemPerguntasError(Exception):
    """Não há perguntas na reserva para o nível do próximo patamar."""


class PerguntaForaDaPartidaError(Exception):
    """A pergunta não é a que a partida em curso entregou (ou não há partida)."""


class PartidaADecidirError(Exception):
    """A partida está à espera da decisão sobre a vida extra -- não se
    responde a mais nada, nem se usam ajudas, até decidir."""


class PartidaCompletaError(Exception):
    """Os 15 patamares já foram superados -- não há próxima pergunta."""


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
class PerguntaDaPartida:
    pergunta: PerguntaJogoRegisto
    # O patamar que esta pergunta vale (1-15).
    patamar: int


@dataclass(frozen=True)
class OfertaVidaExtra:
    custo: int
    restantes: int


@dataclass(frozen=True)
class RecompensaSequencia:
    sequencia: int
    # Os diamantes que entraram mesmo na conta (0 se o limite diário já
    # estava atingido) e os que o marco valia.
    diamantes: int
    diamantes_do_marco: int
    limite_diario_atingido: bool
    # O perfil já com os diamantes creditados -- a barra actualiza logo.
    perfil: PerfilJogadorRegisto


@dataclass(frozen=True)
class ResultadoResposta:
    correta: bool
    # `None` quando a partida fica à espera da decisão sobre a vida extra --
    # a resposta certa só se revela ao terminar (ver docstring do módulo).
    resposta_correta: str | None
    explicacao: str | None
    vida_extra: OfertaVidaExtra | None = None
    sequencia_acertos: int = 0
    recompensa_sequencia: RecompensaSequencia | None = None


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
        relogio: Callable[[], datetime] = lambda: datetime.now(UTC),
    ) -> None:
        self._perguntas = perguntas
        self._perfis = perfis
        self._partidas = partidas
        self._relogio = relogio

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
        if partida.estado == "a_aguardar_decisao" and partida.pergunta_atual_id:
            pergunta = self._perguntas.obter_por_id(partida.pergunta_atual_id)
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

    def _partida_em_curso(self, utilizador_id: str) -> PartidaRegisto:
        """A partida aberta (cria uma se não houver -- ex.: o pedido de
        início falhou na rede), desde que não esteja à espera de decisão."""
        partida = self._partidas.obter_ativa(utilizador_id) or self._partidas.criar(utilizador_id)
        if partida.estado == "a_aguardar_decisao":
            raise PartidaADecidirError()
        return partida

    def _pergunta_da_partida(self, utilizador_id: str, pergunta_id: str) -> tuple[PartidaRegisto, PerguntaJogoRegisto]:
        """A partida em curso e a pergunta pedida -- só se for a que a partida
        entregou. Qualquer outro id é recusado, exista ou não."""
        partida = self._partidas.obter_ativa(utilizador_id)
        if partida is None or partida.pergunta_atual_id != pergunta_id:
            raise PerguntaForaDaPartidaError()
        if partida.estado == "a_aguardar_decisao":
            raise PartidaADecidirError()
        pergunta = self._perguntas.obter_por_id(pergunta_id)
        if pergunta is None:
            raise PerguntaNaoEncontradaError(pergunta_id)
        return partida, pergunta

    # --- Perguntas -----------------------------------------------------------

    def nova_pergunta(self, utilizador_id: str) -> PerguntaDaPartida:
        """Sorteia a pergunta do próximo patamar e prende-a à partida. Pedir
        outra antes de responder à actual é "trocar pergunta" -- uma vez por
        partida, gasta de forma atómica."""
        partida = self._partida_em_curso(utilizador_id)
        patamar = partida.patamar_superado + 1
        if patamar > TOTAL_PATAMARES:
            raise PartidaCompletaError()
        troca = partida.pergunta_atual_id is not None
        if troca and partida.trocar_pergunta_usada:
            raise AjudaJaUsadaError("trocar_pergunta")

        pergunta = self._perguntas.obter_aleatoria(
            nivel_dificuldade_do_patamar(patamar), excluir_id=partida.pergunta_atual_id
        )
        if pergunta is None:
            raise SemPerguntasError()
        if self._partidas.definir_pergunta(partida.id, pergunta.id, troca) is None:
            # Outro pedido mexeu na partida entretanto (trocou ou errou).
            raise AjudaJaUsadaError("trocar_pergunta") if troca else PartidaADecidirError()
        return PerguntaDaPartida(pergunta=pergunta, patamar=patamar)

    # --- Responder -----------------------------------------------------------

    def responder(self, utilizador_id: str, pergunta_id: str, resposta_usuario: str) -> ResultadoResposta:
        partida, pergunta = self._pergunta_da_partida(utilizador_id, pergunta_id)
        if resposta_usuario != pergunta.resposta_correta:
            return self._falhar(partida, pergunta, resposta_usuario)

        self._perfis.obter_ou_criar(utilizador_id)
        sequencia = partida.sequencia_acertos + 1
        bonus = recompensa_sequencia(sequencia)
        acerto = self._partidas.registar_acerto(
            partida.id,
            utilizador_id,
            pergunta.id,
            min(partida.patamar_superado + 1, TOTAL_PATAMARES),
            sequencia,
            bonus,
            self._relogio().astimezone(UTC).date(),
            LIMITE_DIARIO_DIAMANTES_SEQUENCIA,
            pergunta.categoria,
        )
        if acerto is None:
            # Já respondida por outro pedido -- não conta (nem paga) duas vezes.
            raise PerguntaForaDaPartidaError()
        recompensa = None
        if bonus:
            recompensa = RecompensaSequencia(
                sequencia=sequencia,
                diamantes=acerto.diamantes_creditados,
                diamantes_do_marco=bonus,
                limite_diario_atingido=acerto.diamantes_creditados < bonus,
                perfil=acerto.perfil,
            )
        return ResultadoResposta(
            correta=True,
            resposta_correta=pergunta.resposta_correta,
            explicacao=pergunta.explicacao,
            sequencia_acertos=sequencia,
            recompensa_sequencia=recompensa,
        )

    def esgotar_tempo(self, utilizador_id: str, pergunta_id: str) -> ResultadoResposta:
        """O tempo acabou sem resposta -- conta sempre como errada. Antes de
        2026-09-24 o cliente enviava "A" a `responder`; quando "A" era a
        certa, o servidor avançava o progresso sem resposta nenhuma."""
        partida, pergunta = self._pergunta_da_partida(utilizador_id, pergunta_id)
        return self._falhar(partida, pergunta, None)

    def _falhar(
        self, partida: PartidaRegisto, pergunta: PerguntaJogoRegisto, opcao: str | None
    ) -> ResultadoResposta:
        atualizada = self._partidas.registar_falha(
            partida.id, partida.utilizador_id, pergunta.id, opcao, pergunta.categoria
        )
        if atualizada is None:
            raise PerguntaForaDaPartidaError()
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
            or partida.pergunta_atual_id is None
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
            pergunta_id=partida.pergunta_atual_id,
            opcao_falhada=partida.opcao_falhada,
            vidas_restantes=MAXIMO_VIDAS_EXTRA_POR_PARTIDA - resultado.partida.vidas_extra_usadas,
        )

    # --- Ajudas grátis ------------------------------------------------------
    #
    # Nunca mexem no progresso (até 2026-09-24 chamavam `responder` com "A" e
    # zeravam-no sempre que "A" estava errada). Só para a pergunta actual da
    # partida, e cada uma só uma vez por partida (marcada de forma atómica).
    #
    # Deterministas por pergunta (semente = id da pergunta): repetir o pedido
    # devolve sempre o mesmo resultado, por isso não dá para somar várias
    # sondagens até a resposta certa sobressair.

    def cinquenta_cinquenta(self, utilizador_id: str, pergunta_id: str) -> list[str]:
        """Duas opções erradas a esconder, por ordem alfabética."""
        pergunta = self._gastar_ajuda(utilizador_id, pergunta_id, "cinquenta_cinquenta")
        erradas = [o for o in OPCOES if o != pergunta.resposta_correta]
        return sorted(random.Random(f"5050:{pergunta_id}").sample(erradas, 2))

    def opiniao_publico(self, utilizador_id: str, pergunta_id: str) -> dict[str, int]:
        """Sondagem simulada: a certa entre 55% e 75%, o resto repartido
        pelas outras três (nunca 0%), soma sempre 100."""
        pergunta = self._gastar_ajuda(utilizador_id, pergunta_id, "opiniao_publico")
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

    def _gastar_ajuda(self, utilizador_id: str, pergunta_id: str, ajuda: AjudaPartida) -> PerguntaJogoRegisto:
        partida, pergunta = self._pergunta_da_partida(utilizador_id, pergunta_id)
        if not self._partidas.marcar_ajuda(partida.id, ajuda):
            raise AjudaJaUsadaError(ajuda)
        return pergunta
