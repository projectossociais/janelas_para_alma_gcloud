"""Acesso aos exercícios: estado (premium / trial), início do trial de 7
dias e URL assinado dos vídeos. A regra vive no `AcessoExerciciosService`
— aqui só se traduz para HTTP (CLAUDE.md §3/§7)."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import obter_settings
from app.core.dependencies import obter_utilizador_atual, obter_utilizador_atual_opcional
from app.db import obter_sessao
from app.repositories.acesso_exercicios_repository import SQLAlchemyAcessoExerciciosRepository
from app.repositories.storage import R2VideosPresigner
from app.repositories.utilizadores_repository import UtilizadorRegisto
from app.schemas.exercicios import AcessoExerciciosPublico, VideoExercicioPublico
from app.services.acesso_exercicios_service import (
    EXERCICIOS_PREMIUM,
    EXERCICIOS_TRIAL,
    AcessoExercicios,
    AcessoExerciciosService,
    ExercicioDesconhecidoError,
    PresignerDeLeitura,
    SemAcessoAoExercicioError,
    TrialJaUtilizadoError,
)

router = APIRouter(prefix="/exercicios", tags=["exercicios"])


def obter_acesso_exercicios_service(
    sessao: Session = Depends(obter_sessao),
) -> AcessoExerciciosService:
    return AcessoExerciciosService(SQLAlchemyAcessoExerciciosRepository(sessao))


def obter_presigner_videos() -> PresignerDeLeitura | None:
    if not obter_settings().r2_bucket_videos:
        return None
    return R2VideosPresigner()


def _publico(acesso: AcessoExercicios) -> AcessoExerciciosPublico:
    return AcessoExerciciosPublico(
        estado=acesso.estado.value,
        exercicios_desbloqueados=list(acesso.exercicios_desbloqueados),
        exercicios_trial=list(EXERCICIOS_TRIAL),
        exercicios_premium=list(EXERCICIOS_PREMIUM),
        trial_iniciado_em=acesso.trial_iniciado_em,
        trial_termina_em=acesso.trial_termina_em,
        trial_dias_restantes=acesso.trial_dias_restantes,
    )


@router.get("/acesso", response_model=AcessoExerciciosPublico)
def obter_acesso(
    utilizador: UtilizadorRegisto | None = Depends(obter_utilizador_atual_opcional),
    service: AcessoExerciciosService = Depends(obter_acesso_exercicios_service),
) -> AcessoExerciciosPublico:
    if utilizador is None:
        return AcessoExerciciosPublico(
            estado="sem_sessao",
            exercicios_desbloqueados=[],
            exercicios_trial=list(EXERCICIOS_TRIAL),
            exercicios_premium=list(EXERCICIOS_PREMIUM),
        )
    return _publico(service.obter_acesso(utilizador.id))


@router.post("/trial", response_model=AcessoExerciciosPublico)
def iniciar_trial(
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    service: AcessoExerciciosService = Depends(obter_acesso_exercicios_service),
) -> AcessoExerciciosPublico:
    """Inicia o teste de 7 dias — uma única vez por conta. O início conta
    a partir de agora (UTC), no servidor; nada vem do corpo do pedido."""
    try:
        return _publico(service.iniciar_trial(utilizador.id))
    except TrialJaUtilizadoError:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="o teste gratuito já foi utilizado")


@router.get("/{exercicio_id}/video", response_model=VideoExercicioPublico)
def obter_video(
    exercicio_id: str,
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    service: AcessoExerciciosService = Depends(obter_acesso_exercicios_service),
    presigner: PresignerDeLeitura | None = Depends(obter_presigner_videos),
) -> VideoExercicioPublico:
    # Acesso verificado antes de dizer seja o que for sobre a disponibilidade
    # dos vídeos — quem não tem acesso recebe sempre 403/404.
    try:
        service.verificar_acesso(utilizador.id, exercicio_id)
    except ExercicioDesconhecidoError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="exercício desconhecido")
    except SemAcessoAoExercicioError:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="sem acesso a este exercício")
    if presigner is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail="vídeos ainda não disponíveis")
    return VideoExercicioPublico(url=service.url_do_video(utilizador.id, exercicio_id, presigner))
