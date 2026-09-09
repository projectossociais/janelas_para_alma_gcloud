"""Feedback é público de propósito (funciona sem sessão) — identifica o
utilizador quando ele tem uma, sem exigir. Sem service: só validação de
forma (rating 1-5, comentário curto), não decide acesso, dinheiro nem
resultado clínico (ver CLAUDE.md secção 3).
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import obter_utilizador_atual_opcional
from app.db import obter_sessao
from app.repositories.feedback_repository import SQLAlchemyFeedbackRepository
from app.repositories.utilizadores_repository import UtilizadorRegisto
from app.schemas.feedback import FeedbackCriar, FeedbackPublico

router = APIRouter(prefix="/feedback", tags=["feedback"])


def obter_feedback_repository(sessao: Session = Depends(obter_sessao)) -> SQLAlchemyFeedbackRepository:
    return SQLAlchemyFeedbackRepository(sessao)


@router.post("", response_model=FeedbackPublico, status_code=status.HTTP_201_CREATED)
def registar_feedback(
    dados: FeedbackCriar,
    utilizador: UtilizadorRegisto | None = Depends(obter_utilizador_atual_opcional),
    repo: SQLAlchemyFeedbackRepository = Depends(obter_feedback_repository),
) -> FeedbackPublico:
    registo = repo.criar(
        avaliacao=dados.avaliacao,
        comentario=dados.comentario,
        user_id=utilizador.id if utilizador else None,
    )
    return FeedbackPublico.model_validate(registo)
