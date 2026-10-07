from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import obter_utilizador_atual_opcional
from app.db import obter_sessao
from app.repositories.screening_repository import SQLAlchemyScreeningsRepository
from app.repositories.utilizadores_repository import UtilizadorRegisto
from app.routers.consentimento import obter_consentimento_saude_service
from app.schemas.rastreio_completo import MedicoesRastreioCriar, ResultadoRastreioPublico
from app.services.classificacao_rastreio_service import MedicoesRastreio
from app.services.consentimento_saude_service import (
    ConsentimentoEmFaltaError,
    ConsentimentoSaudeService,
)
from app.services.rastreio_completo_service import RastreioCompletoService

router = APIRouter(prefix="/rastreio-completo", tags=["rastreio-completo"])


def obter_rastreio_completo_service(
    sessao: Session = Depends(obter_sessao),
) -> RastreioCompletoService:
    return RastreioCompletoService(SQLAlchemyScreeningsRepository(sessao))


@router.post("", response_model=ResultadoRastreioPublico)
def classificar_rastreio(
    dados: MedicoesRastreioCriar,
    utilizador: UtilizadorRegisto | None = Depends(obter_utilizador_atual_opcional),
    consentimento: ConsentimentoSaudeService = Depends(obter_consentimento_saude_service),
    service: RastreioCompletoService = Depends(obter_rastreio_completo_service),
) -> ResultadoRastreioPublico:
    """Decide o resultado a partir das medições do telemóvel. Aberto a convidados
    (recebem o resultado, nada se grava). Com sessão **e** consentimento de dados
    de saúde (CLAUDE.md §4.9) e havendo medição, grava no histórico; sem
    consentimento não dá 403, só não grava -- o resultado é da pessoa na mesma."""
    user_id: str | None = None
    if utilizador is not None:
        try:
            consentimento.exigir(utilizador.id)
            user_id = utilizador.id
        except ConsentimentoEmFaltaError:
            user_id = None
    resultado = service.classificar_e_registar(MedicoesRastreio(**dados.model_dump()), user_id)
    c = resultado.classificacao
    return ResultadoRastreioPublico(
        conclusao=c.conclusao,
        motivo=c.motivo,
        versao_regra=c.versao_regra,
        screening_id=resultado.screening_id,
    )
