"""Painel de administração — listar contas e gerir quem é admin.

Tudo aqui exige `papel: admin` (via `obter_utilizador_admin`). O primeiro
admin cria-se por linha de comando (`python -m app.criar_admin <email>`);
a partir daí, um admin promove outros por aqui.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import obter_utilizador_admin
from app.db import obter_sessao
from app.repositories.admin_repository import AdminUtilizadorRegisto, SQLAlchemyAdminRepository
from app.repositories.utilizadores_repository import UtilizadorRegisto
from app.schemas.admin import AdminUtilizadorPublico, PromoverAdmin
from app.services.admin_service import (
    AdminService,
    NaoPodeDespromoverASiProprioError,
    UltimoAdminError,
    UtilizadorNaoEncontradoError,
)

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(obter_utilizador_admin)])


def obter_admin_service(sessao: Session = Depends(obter_sessao)) -> AdminService:
    return AdminService(SQLAlchemyAdminRepository(sessao))


def obter_admin_repository(sessao: Session = Depends(obter_sessao)) -> SQLAlchemyAdminRepository:
    return SQLAlchemyAdminRepository(sessao)


@router.get("/utilizadores", response_model=list[AdminUtilizadorPublico])
def listar_utilizadores(
    papel: str | None = None,
    repo: SQLAlchemyAdminRepository = Depends(obter_admin_repository),
) -> list[AdminUtilizadorRegisto]:
    return repo.listar(papel=papel)


@router.post("/utilizadores/promover", response_model=AdminUtilizadorPublico)
def promover_a_admin(
    dados: PromoverAdmin,
    servico: AdminService = Depends(obter_admin_service),
) -> AdminUtilizadorRegisto:
    try:
        return servico.promover_a_admin(dados.email)
    except UtilizadorNaoEncontradoError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="não há nenhuma conta com esse email — peça-lhe para se registar primeiro",
        ) from exc


@router.post("/utilizadores/{utilizador_id}/remover-admin", response_model=AdminUtilizadorPublico)
def remover_admin(
    utilizador_id: str,
    executor: UtilizadorRegisto = Depends(obter_utilizador_admin),
    servico: AdminService = Depends(obter_admin_service),
) -> AdminUtilizadorRegisto:
    try:
        return servico.despromover(utilizador_id, executor.id)
    except NaoPodeDespromoverASiProprioError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="não pode remover o seu próprio acesso de admin"
        ) from exc
    except UltimoAdminError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="é o último admin — promova outra conta antes de remover esta",
        ) from exc
    except UtilizadorNaoEncontradoError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="conta não encontrada") from exc
