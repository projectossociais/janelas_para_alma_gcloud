"""Acesso a dados das sessões de exercício.

Gravar uma sessão de exercício é escrita simples — o router fala directo
com este repository, sem service (ver CLAUDE.md secção 3, tabela: "Gravar
uma sessão de exercício" está do lado do router fino). A única coisa em
que o utilizador podia mentir — de quem é a sessão — resolve-se no router
tirando o `user_id` do JWT, nunca do corpo do pedido.

Tal como `doacoes_repository.py`: nenhum `try/except` à volta do `commit()`.
Se a gravação falhar, a excepção propaga — quem chama decide o que fazer,
este ficheiro nunca fabrica um sucesso.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from sqlalchemy.orm import Session

from app.repositories.orm_models import SessaoExercicio


@dataclass(frozen=True)
class SessaoExercicioRegisto:
    id: str
    user_id: str
    exercicio_id: str
    duracao_segundos: int
    pontuacao: int
    precisao_percentual: float
    detalhes: dict | None
    created_at: datetime


class SessoesExercicioRepository(Protocol):
    def criar(
        self,
        user_id: str,
        exercicio_id: str,
        duracao_segundos: int,
        pontuacao: int,
        precisao_percentual: float,
        detalhes: dict | None,
    ) -> SessaoExercicioRegisto: ...


class SQLAlchemySessoesExercicioRepository:
    def __init__(self, sessao: Session) -> None:
        self._sessao = sessao

    def criar(
        self,
        user_id: str,
        exercicio_id: str,
        duracao_segundos: int,
        pontuacao: int,
        precisao_percentual: float,
        detalhes: dict | None,
    ) -> SessaoExercicioRegisto:
        row = SessaoExercicio(
            user_id=uuid.UUID(user_id),
            exercicio_id=exercicio_id,
            duracao_segundos=duracao_segundos,
            pontuacao=pontuacao,
            precisao_percentual=precisao_percentual,
            detalhes=detalhes,
        )
        self._sessao.add(row)
        self._sessao.commit()
        self._sessao.refresh(row)
        return SessaoExercicioRegisto(
            id=str(row.id),
            user_id=str(row.user_id),
            exercicio_id=row.exercicio_id,
            duracao_segundos=row.duracao_segundos,
            pontuacao=row.pontuacao,
            precisao_percentual=float(row.precisao_percentual),
            detalhes=row.detalhes,
            created_at=row.created_at,
        )
