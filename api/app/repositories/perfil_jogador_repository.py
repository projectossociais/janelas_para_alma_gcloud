"""Acesso a dados da economia do jogo "Você Sabia Que..." -- moedas,
diamantes e estatísticas por utilizador.

`calcular_recompensa` é a única fonte de verdade sobre quanto vale cada
patamar -- o valor nunca vem do cliente. Se o cliente pudesse dizer ao
servidor quantas moedas ganhou, bastava um pedido `POST` forjado para
"imprimir dinheiro"; por isso `POST /jogo/recompensas` recebe só o patamar
alcançado (ver `routers/jogo.py`) e a moeda/diamante ganhos são sempre
recalculados aqui, nunca aceites tal e qual do corpo do pedido.
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


class PerfilJogadorRepository(Protocol):
    def obter_ou_criar(self, utilizador_id: str) -> PerfilJogadorRegisto: ...
    def registar_recompensa(
        self, utilizador_id: str, moedas_ganhas: int, diamantes_ganhos: int, patamar_alcancado: int
    ) -> PerfilJogadorRegisto: ...


def _para_registo(row: PerfilJogador) -> PerfilJogadorRegisto:
    return PerfilJogadorRegisto(
        id=str(row.id),
        utilizador_id=str(row.utilizador_id),
        moedas=row.moedas,
        diamantes=row.diamantes,
        partidas_jogadas=row.partidas_jogadas,
        patamar_maximo_alcancado=row.patamar_maximo_alcancado,
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
        return _para_registo(row)

    def registar_recompensa(
        self, utilizador_id: str, moedas_ganhas: int, diamantes_ganhos: int, patamar_alcancado: int
    ) -> PerfilJogadorRegisto:
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
        row.moedas += moedas_ganhas
        row.diamantes += diamantes_ganhos
        row.partidas_jogadas += 1
        row.patamar_maximo_alcancado = max(row.patamar_maximo_alcancado, patamar_alcancado)
        row.updated_at = datetime.now(UTC)
        self._sessao.commit()
        self._sessao.refresh(row)
        return _para_registo(row)
