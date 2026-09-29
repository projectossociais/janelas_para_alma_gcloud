"""Endpoints chamados por infra própria (Cloud Scheduler), nunca por um
browser -- protegidos por `obter_cron_valido` (segredo em cabeçalho), nunca
por sessão de utilizador. Ver docs/BACKLOG.md, W-03.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import obter_cron_valido, obter_email_sender
from app.core.email import EmailSender
from app.db import obter_sessao
from app.repositories.eliminacao_conta_repository import SQLAlchemyEliminacaoContaRepository
from app.repositories.lembrete_exercicios_repository import SQLAlchemyLembreteExerciciosRepository
from app.schemas.interno import EliminacoesProcessadas, LembretesEnviados
from app.services.eliminacao_conta_service import EliminacaoContaService
from app.services.lembrete_exercicios_service import LembreteExerciciosService

router = APIRouter(prefix="/interno", tags=["interno"], dependencies=[Depends(obter_cron_valido)])


def obter_eliminacao_conta_repository(
    sessao: Session = Depends(obter_sessao),
) -> SQLAlchemyEliminacaoContaRepository:
    return SQLAlchemyEliminacaoContaRepository(sessao)


def obter_eliminacao_conta_service(
    repo: SQLAlchemyEliminacaoContaRepository = Depends(obter_eliminacao_conta_repository),
) -> EliminacaoContaService:
    return EliminacaoContaService(repo)


@router.post("/eliminar-contas-pendentes", response_model=EliminacoesProcessadas)
def eliminar_contas_pendentes(
    servico: EliminacaoContaService = Depends(obter_eliminacao_conta_service),
) -> EliminacoesProcessadas:
    return EliminacoesProcessadas(contas_anonimizadas=servico.processar_pendentes())


def obter_lembrete_exercicios_service(
    sessao: Session = Depends(obter_sessao),
    email_sender: EmailSender = Depends(obter_email_sender),
) -> LembreteExerciciosService:
    return LembreteExerciciosService(SQLAlchemyLembreteExerciciosRepository(sessao), email_sender)


@router.post("/lembretes-exercicios", response_model=LembretesEnviados)
def enviar_lembretes_exercicios(
    servico: LembreteExerciciosService = Depends(obter_lembrete_exercicios_service),
) -> LembretesEnviados:
    r = servico.enviar_lembretes()
    return LembretesEnviados(enviados=r.enviados, falhados=r.falhados)
