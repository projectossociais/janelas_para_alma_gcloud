from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import obter_utilizador_atual
from app.db import obter_sessao
from app.repositories.perfil_repository import PerfilPatch, SQLAlchemyPerfilRepository
from app.repositories.utilizadores_repository import UtilizadorRegisto
from app.schemas.perfil import PerfilAtualizar, PerfilPublico
from app.services.perfil_service import PerfilNaoEncontradoError, PerfilService

router = APIRouter(prefix="/perfil", tags=["perfil"])


def obter_perfil_service(sessao: Session = Depends(obter_sessao)) -> PerfilService:
    return PerfilService(SQLAlchemyPerfilRepository(sessao))


@router.get("", response_model=PerfilPublico)
def obter_perfil(
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    service: PerfilService = Depends(obter_perfil_service),
) -> PerfilPublico:
    try:
        perfil = service.obter(utilizador.id)
    except PerfilNaoEncontradoError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="perfil não encontrado") from exc

    return PerfilPublico.model_validate(perfil)


@router.patch("", response_model=PerfilPublico)
def atualizar_perfil(
    dados: PerfilAtualizar,
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    service: PerfilService = Depends(obter_perfil_service),
) -> PerfilPublico:
    patch = PerfilPatch(**dados.model_dump())
    try:
        perfil = service.atualizar(utilizador.id, patch)
    except PerfilNaoEncontradoError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="perfil não encontrado") from exc

    return PerfilPublico.model_validate(perfil)
