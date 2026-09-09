from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from sqlalchemy.orm import Session

from app.repositories.orm_models import UserFeedback


@dataclass(frozen=True)
class FeedbackRegisto:
    id: str
    avaliacao: int
    comentario: str | None
    user_id: str | None
    created_at: datetime


class FeedbackRepository(Protocol):
    def criar(self, avaliacao: int, comentario: str | None, user_id: str | None) -> FeedbackRegisto: ...


class SQLAlchemyFeedbackRepository:
    def __init__(self, sessao: Session) -> None:
        self._sessao = sessao

    def criar(self, avaliacao: int, comentario: str | None, user_id: str | None) -> FeedbackRegisto:
        row = UserFeedback(avaliacao=avaliacao, comentario=comentario, user_id=user_id)
        self._sessao.add(row)
        self._sessao.commit()
        self._sessao.refresh(row)
        return FeedbackRegisto(
            id=str(row.id),
            avaliacao=row.avaliacao,
            comentario=row.comentario,
            user_id=str(row.user_id) if row.user_id else None,
            created_at=row.created_at,
        )
