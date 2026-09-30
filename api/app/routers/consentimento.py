from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import obter_utilizador_atual
from app.db import obter_sessao
from app.repositories.consentimento_saude_repository import SQLAlchemyConsentimentoSaudeRepository
from app.repositories.utilizadores_repository import UtilizadorRegisto
from app.schemas.consentimento import ConsentimentoSaudeCriar, ConsentimentoSaudeEstado
from app.services.consentimento_saude_service import (
    ConsentimentoEmFaltaError,
    ConsentimentoSaudeService,
    DeclaracaoEmFaltaError,
    EstadoConsentimento,
)

router = APIRouter(prefix="/consentimento-saude", tags=["consentimento"])

# Código estável que o frontend reconhece para abrir o pedido de consentimento.
DETALHE_CONSENTIMENTO_EM_FALTA = "consentimento_dados_saude_em_falta"


def obter_consentimento_saude_service(sessao: Session = Depends(obter_sessao)) -> ConsentimentoSaudeService:
    return ConsentimentoSaudeService(SQLAlchemyConsentimentoSaudeRepository(sessao))


def exigir_consentimento_saude(
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    service: ConsentimentoSaudeService = Depends(obter_consentimento_saude_service),
) -> UtilizadorRegisto:
    """Dependency das rotas que gravam dados de saúde (rastreios, sessões de
    exercício): sem consentimento válido, 403 antes de gravar -- nunca confiar
    só na interface (CLAUDE.md §4.1 e §4.9)."""
    try:
        service.exigir(utilizador.id)
    except ConsentimentoEmFaltaError:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail=DETALHE_CONSENTIMENTO_EM_FALTA)
    return utilizador


def _publico(e: EstadoConsentimento) -> ConsentimentoSaudeEstado:
    return ConsentimentoSaudeEstado(
        consentido=e.consentido,
        versao_actual=e.versao_actual,
        versao_aceite=e.versao_aceite,
        aceite_em=e.aceite_em,
        representa_menor=e.representa_menor,
    )


@router.get("", response_model=ConsentimentoSaudeEstado)
def obter_estado(
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    service: ConsentimentoSaudeService = Depends(obter_consentimento_saude_service),
) -> ConsentimentoSaudeEstado:
    return _publico(service.estado(utilizador.id))


@router.post("", response_model=ConsentimentoSaudeEstado)
def dar_consentimento(
    dados: ConsentimentoSaudeCriar,
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    service: ConsentimentoSaudeService = Depends(obter_consentimento_saude_service),
) -> ConsentimentoSaudeEstado:
    try:
        estado = service.registar(
            utilizador.id,
            declara_maioridade=dados.declara_maioridade,
            aceita_tratamento=dados.aceita_tratamento,
            representa_menor=dados.representa_menor,
        )
    except DeclaracaoEmFaltaError:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="é preciso declarar a maioridade e aceitar o tratamento",
        )
    return _publico(estado)


@router.delete("", response_model=ConsentimentoSaudeEstado)
def retirar_consentimento(
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    service: ConsentimentoSaudeService = Depends(obter_consentimento_saude_service),
) -> ConsentimentoSaudeEstado:
    return _publico(service.retirar(utilizador.id))
