"""Acesso a dados da economia do jogo "Inclusivamente" -- moedas, diamantes
e estatísticas por utilizador.

`calcular_recompensa` é a única fonte de verdade sobre quanto vale cada
patamar -- o valor nunca vem do cliente. E o próprio patamar também não: é
o `patamar_superado` da partida (`partidas_jogo`), que só avança quando
`JogoService.responder` confirma no servidor uma resposta certa. A
recompensa é paga ao terminar a partida, em
`PartidaJogoRepository.terminar` (uma única vez por partida).
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.repositories.orm_models import PerfilJogador

MOEDAS_POR_PATAMAR = 50

# Bónus de diamantes nos marcos clássicos do jogo -- 5, 10 e 15 (vitória).
# Não é cumulativo: alcançar o patamar 15 dá 5, não 1+2+5.
_MARCOS_DIAMANTES: tuple[tuple[int, int], ...] = ((15, 5), (10, 2), (5, 1))


def calcular_recompensa(patamar_alcancado: int) -> tuple[int, int]:
    """Moedas e diamantes ganhos por uma partida que terminou tendo já
    superado `patamar_alcancado` patamares (0 se falhou logo no primeiro)."""
    moedas = patamar_alcancado * MOEDAS_POR_PATAMAR
    diamantes = next((d for marco, d in _MARCOS_DIAMANTES if patamar_alcancado >= marco), 0)
    return moedas, diamantes


@dataclass(frozen=True)
class PerfilJogadorRegisto:
    id: str
    utilizador_id: str
    moedas: int
    diamantes: int
    partidas_jogadas: int
    patamar_maximo_alcancado: int
    melhor_sequencia: int = 0
    patamares_superados_total: int = 0
    moedas_ganhas_total: int = 0


class PerfilJogadorRepository(Protocol):
    def obter_ou_criar(self, utilizador_id: str) -> PerfilJogadorRegisto: ...
    def creditar_diamantes(self, utilizador_id: str, quantidade: int) -> PerfilJogadorRegisto: ...


def para_registo(row: PerfilJogador) -> PerfilJogadorRegisto:
    return PerfilJogadorRegisto(
        id=str(row.id),
        utilizador_id=str(row.utilizador_id),
        moedas=row.moedas,
        diamantes=row.diamantes,
        partidas_jogadas=row.partidas_jogadas,
        patamar_maximo_alcancado=row.patamar_maximo_alcancado,
        melhor_sequencia=row.melhor_sequencia,
        patamares_superados_total=row.patamares_superados_total,
        moedas_ganhas_total=row.moedas_ganhas_total,
    )


class SQLAlchemyPerfilJogadorRepository:
    def __init__(self, sessao: Session) -> None:
        self._sessao = sessao

    def _obter_row(self, utilizador_id: str) -> PerfilJogador | None:
        return self._sessao.scalars(
            select(PerfilJogador).where(PerfilJogador.utilizador_id == uuid.UUID(utilizador_id))
        ).first()

    def obter_ou_criar(self, utilizador_id: str) -> PerfilJogadorRegisto:
        row = self._obter_row(utilizador_id)
        if row is None:
            row = PerfilJogador(
                utilizador_id=uuid.UUID(utilizador_id),
                moedas=0,
                diamantes=0,
                partidas_jogadas=0,
                patamar_maximo_alcancado=0,
            )
            self._sessao.add(row)
            self._sessao.commit()
            self._sessao.refresh(row)
        return para_registo(row)

    def creditar_diamantes(self, utilizador_id: str, quantidade: int) -> PerfilJogadorRegisto:
        """Soma `quantidade` ao saldo de diamantes -- sem tocar em partidas
        nem patamares. Quem decide *quanto* e *porquê* é sempre um service
        (ex.: `LojaJogoService`), nunca o corpo de um pedido."""
        row = self._obter_row(utilizador_id)
        if row is None:
            row = PerfilJogador(
                utilizador_id=uuid.UUID(utilizador_id),
                moedas=0,
                diamantes=0,
                partidas_jogadas=0,
                patamar_maximo_alcancado=0,
            )
            self._sessao.add(row)
        row.diamantes += quantidade
        row.updated_at = datetime.now(UTC)
        self._sessao.commit()
        self._sessao.refresh(row)
        return para_registo(row)
