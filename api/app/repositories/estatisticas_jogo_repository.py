"""Leitura das estatísticas do jogador por categoria de pergunta.

A escrita vive em `PartidaJogoRepository` (na mesma transacção que regista
cada resposta); aqui só se lê o agregado para o Perfil.
"""

import uuid
from dataclasses import dataclass
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.repositories.orm_models import EstatisticaCategoriaJogador


@dataclass(frozen=True)
class EstatisticaCategoriaRegisto:
    categoria: str
    respostas: int
    acertos: int


class EstatisticasJogoRepository(Protocol):
    def listar_por_categoria(self, utilizador_id: str) -> list[EstatisticaCategoriaRegisto]: ...


class SQLAlchemyEstatisticasJogoRepository:
    def __init__(self, sessao: Session) -> None:
        self._sessao = sessao

    def listar_por_categoria(self, utilizador_id: str) -> list[EstatisticaCategoriaRegisto]:
        linhas = self._sessao.scalars(
            select(EstatisticaCategoriaJogador).where(
                EstatisticaCategoriaJogador.utilizador_id == uuid.UUID(utilizador_id)
            )
        ).all()
        return [EstatisticaCategoriaRegisto(linha.categoria, linha.respostas, linha.acertos) for linha in linhas]
