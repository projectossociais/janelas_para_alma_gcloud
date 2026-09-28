"""Endpoints chamados por infra própria (Cloud Scheduler), nunca por um
browser -- protegidos por `obter_cron_valido` (segredo em cabeçalho), nunca
por sessão de utilizador. Ver docs/BACKLOG.md, W-03.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import obter_cron_valido
from app.db import obter_sessao
from app.repositories.eliminacao_conta_repository import SQLAlchemyEliminacaoContaRepository
from app.schemas.interno import EliminacoesProcessadas
from app.services.eliminacao_conta_service import EliminacaoContaService

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
