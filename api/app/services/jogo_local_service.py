"""Regras do Multijogador Local do "Inclusivamente" (2 pessoas à vez no
mesmo aparelho, com a conta de quem tem sessão).

O que o servidor decide: que pergunta se entrega, se a resposta está certa
e quanto vale a partida. O que fica só no aparelho: de quem é a vez, os
nomes e os pontos de cada jogador -- nada disso decide o prémio, por isso
não precisa de ser verdade para o servidor (CLAUDE.md §3).

**Prémio** (criado em 2026-11-10, a pedido do dono do projecto): moedas para
a conta do aparelho, pelos acertos dos dois jogadores juntos --
`MOEDAS_POR_ACERTO` cada, até `MAXIMO_MOEDAS_POR_PARTIDA`, e só com a
partida jogada até ao fim (todas as rondas de todos os jogadores). Como no
mesmo aparelho uma pessoa pode jogar por todos, há um tecto por dia UTC
(`LIMITE_DIARIO_MOEDAS`): acima dele a partida joga-se na mesma, só não
credita. Sem diamantes: esses vendem-se por Kwanzas.
"""

from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Protocol

from app.repositories.jogo_repository import PerguntaJogoRegisto, nivel_dificuldade_do_patamar
from app.repositories.partida_local_jogo_repository import (
    PartidaLocalJogoRepository,
    PartidaLocalRegisto,
)
from app.repositories.perfil_jogador_repository import PerfilJogadorRegisto, PerfilJogadorRepository
from app.services.jogo_service import SemPerguntasError

# Só 2 jogadores (decisão do dono do projecto, 2026-11-10: com mais, o ecrã
# de um telemóvel ficava comprido demais). O resto do código não depende do
# número; a base de dados aceita até 4 (CHECK), para não exigir migração se
# isto mudar.
MINIMO_JOGADORES = 2
MAXIMO_JOGADORES = 2
# Cada jogador responde a uma pergunta por ronda.
RONDAS = 5
# Rondas extra, só entre os empatados no primeiro lugar.
MAXIMO_DESEMPATES = 3

MOEDAS_POR_ACERTO = 10
MAXIMO_MOEDAS_POR_PARTIDA = 100
LIMITE_DIARIO_MOEDAS = 400


class NumeroDeJogadoresInvalidoError(Exception):
    pass


class PartidaLocalNaoEncontradaError(Exception):
    """Não existe, ou é de outra conta (não se distingue, de propósito)."""


class PartidaLocalTerminadaError(Exception):
    pass


class PerguntaForaDaPartidaLocalError(Exception):
    """A pergunta não é a que a partida tem por responder."""


class LimiteDePerguntasError(Exception):
    """A partida já entregou todas as perguntas que podia ter."""


class PerguntasLocaisRepository(Protocol):
    def obter_aleatoria_fora_de(
        self, nivel_dificuldade: int, excluir_ids: tuple[str, ...] = ()
    ) -> PerguntaJogoRegisto | None: ...
    def obter_por_id(self, pergunta_id: str) -> PerguntaJogoRegisto | None: ...


@dataclass(frozen=True)
class RespostaLocal:
    correta: bool
    resposta_correta: str
    explicacao: str | None


@dataclass(frozen=True)
class PartidaLocalTerminada:
    moedas_ganhas: int
    # O prémio existia, mas o tecto diário já não deixou creditá-lo todo.
    limite_diario_atingido: bool
    perfil: PerfilJogadorRegisto


def maximo_de_perguntas(numero_jogadores: int) -> int:
    return numero_jogadores * (RONDAS + MAXIMO_DESEMPATES)


class JogoLocalService:
    def __init__(
        self,
        perguntas: PerguntasLocaisRepository,
        perfis: PerfilJogadorRepository,
        partidas: PartidaLocalJogoRepository,
        relogio: Callable[[], datetime] = lambda: datetime.now(UTC),
    ) -> None:
        self._perguntas = perguntas
        self._perfis = perfis
        self._partidas = partidas
        self._relogio = relogio

    def iniciar(self, utilizador_id: str, numero_jogadores: int) -> PartidaLocalRegisto:
        if not MINIMO_JOGADORES <= numero_jogadores <= MAXIMO_JOGADORES:
            raise NumeroDeJogadoresInvalidoError()
        return self._partidas.criar(utilizador_id, numero_jogadores, self._relogio())

    def _em_curso(self, utilizador_id: str, partida_id: str) -> PartidaLocalRegisto:
        partida = self._partidas.obter(partida_id, utilizador_id)
        if partida is None:
            raise PartidaLocalNaoEncontradaError()
        if partida.estado != "em_curso":
            raise PartidaLocalTerminadaError()
        return partida

    def nova_pergunta(self, utilizador_id: str, partida_id: str, patamar: int) -> PerguntaJogoRegisto:
        """A próxima pergunta. Idempotente: com uma por responder, devolve
        essa (um "Tentar novamente" nunca salta uma pergunta). O `patamar`
        vem do aparelho e só escolhe a dificuldade."""
        partida = self._em_curso(utilizador_id, partida_id)
        if partida.pergunta_atual_id is not None:
            return self._pergunta(partida.pergunta_atual_id)
        if len(partida.perguntas_entregues) >= maximo_de_perguntas(partida.numero_jogadores):
            raise LimiteDePerguntasError()

        nivel = nivel_dificuldade_do_patamar(patamar)
        pergunta = self._perguntas.obter_aleatoria_fora_de(
            nivel, partida.perguntas_entregues
        ) or self._perguntas.obter_aleatoria_fora_de(nivel)
        if pergunta is None:
            raise SemPerguntasError()
        if self._partidas.definir_pergunta(partida.id, pergunta.id) is None:
            # Outro pedido entregou uma pergunta entretanto -- fica essa.
            partida = self._em_curso(utilizador_id, partida_id)
            if partida.pergunta_atual_id is None:
                raise PartidaLocalTerminadaError()
            return self._pergunta(partida.pergunta_atual_id)
        return pergunta

    def _pergunta(self, pergunta_id: str) -> PerguntaJogoRegisto:
        pergunta = self._perguntas.obter_por_id(pergunta_id)
        if pergunta is None:
            raise SemPerguntasError()
        return pergunta

    def responder(
        self, utilizador_id: str, partida_id: str, pergunta_id: str, resposta: str | None
    ) -> RespostaLocal:
        """Valida a resposta à pergunta por responder (`None` = tempo
        esgotado). Revela a certa: no modo local não há segunda tentativa."""
        partida = self._em_curso(utilizador_id, partida_id)
        if partida.pergunta_atual_id is None or partida.pergunta_atual_id != pergunta_id:
            raise PerguntaForaDaPartidaLocalError()
        pergunta = self._pergunta(pergunta_id)
        correta = resposta is not None and resposta == pergunta.resposta_correta
        if self._partidas.registar_resposta(partida.id, pergunta_id, correta) is None:
            raise PerguntaForaDaPartidaLocalError()
        return RespostaLocal(
            correta=correta, resposta_correta=pergunta.resposta_correta, explicacao=pergunta.explicacao
        )

    def terminar(self, utilizador_id: str, partida_id: str) -> PartidaLocalTerminada:
        """Fecha a partida e credita o prémio, uma única vez."""
        partida = self._em_curso(utilizador_id, partida_id)
        self._perfis.obter_ou_criar(utilizador_id)
        terminada = self._partidas.terminar(
            partida.id,
            utilizador_id,
            moedas_por_acerto=MOEDAS_POR_ACERTO,
            maximo_por_partida=MAXIMO_MOEDAS_POR_PARTIDA,
            minimo_respostas=partida.numero_jogadores * RONDAS,
            limite_diario=LIMITE_DIARIO_MOEDAS,
            agora=self._relogio(),
        )
        if terminada is None:
            raise PartidaLocalTerminadaError()
        creditadas = terminada.partida.moedas_ganhas or 0
        return PartidaLocalTerminada(
            moedas_ganhas=creditadas,
            limite_diario_atingido=creditadas < terminada.premio_sem_limite,
            perfil=terminada.perfil,
        )
