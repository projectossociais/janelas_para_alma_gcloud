"""Router de doações. Público de propósito — doar não exige conta, só um
email para onde mandar a confirmação (quando essa parte da infra existir,
ver docs/BACKLOG.md).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import obter_sessao
from app.repositories.doacoes_repository import SQLAlchemyDoacoesRepository
from app.schemas.doacao import DoacaoMateriaisCriar, DoacaoPublica
from app.services.doacao_service import DoacaoService, MateriaisNaoSelecionadosError

router = APIRouter(prefix="/doacoes", tags=["doacoes"])


def obter_doacao_service(sessao: Session = Depends(obter_sessao)) -> DoacaoService:
    return DoacaoService(SQLAlchemyDoacoesRepository(sessao))


@router.post("/materiais", response_model=DoacaoPublica, status_code=status.HTTP_201_CREATED)
def registar_doacao_materiais(
    dados: DoacaoMateriaisCriar, service: DoacaoService = Depends(obter_doacao_service)
) -> DoacaoPublica:
    # Só apanha o erro de validação de negócio. Uma falha de gravação
    # (excepção do SQLAlchemy) não é apanhada aqui -- propaga para um 500,
    # nunca um 201 fabricado. Ver DoacaoService e CLAUDE.md, "Nunca mostrar
    # sucesso antes de verificar error/excepção".
    try:
        doacao = service.registar_doacao_materiais(dados.email, dados.materiais, dados.detalhes)
    except MateriaisNaoSelecionadosError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)) from exc

    return DoacaoPublica.model_validate(doacao)
