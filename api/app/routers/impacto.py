"""Números de impacto da página inicial. Público: só contagens agregadas,
nenhum dado de ninguém. Leitura simples, por isso o router fala com o
repository sem service (CLAUDE.md §3)."""

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.db import obter_sessao
from app.repositories.impacto_repository import NumerosImpactoRegisto, SQLAlchemyImpactoRepository
from app.schemas.impacto import NumerosImpacto

router = APIRouter(prefix="/impacto", tags=["impacto"])

# Os números mudam devagar e a página inicial é a mais vista: cinco minutos
# de cache poupam contagens repetidas à base de dados.
CACHE_SEGUNDOS = 300


def obter_impacto_repository(sessao: Session = Depends(obter_sessao)) -> SQLAlchemyImpactoRepository:
    return SQLAlchemyImpactoRepository(sessao)


@router.get("/numeros", response_model=NumerosImpacto)
def obter_numeros(
    response: Response,
    repo: SQLAlchemyImpactoRepository = Depends(obter_impacto_repository),
) -> NumerosImpactoRegisto:
    response.headers["Cache-Control"] = f"public, max-age={CACHE_SEGUNDOS}"
    return repo.obter_numeros()
