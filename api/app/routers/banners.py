from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import obter_utilizador_admin
from app.db import obter_sessao
from app.repositories.banners_repository import (
    BannerPatch,
    BannerRegisto,
    SQLAlchemyBannersRepository,
)
from app.schemas.banner import BannerAdmin, BannerAtualizar, BannerCriar, BannerPublico

router = APIRouter(prefix="/banners", tags=["banners"])


def obter_banners_repository(sessao: Session = Depends(obter_sessao)) -> SQLAlchemyBannersRepository:
    return SQLAlchemyBannersRepository(sessao)


@router.get("/ativo", response_model=BannerPublico | None)
def obter_banner_ativo(
    repo: SQLAlchemyBannersRepository = Depends(obter_banners_repository),
) -> BannerRegisto | None:
    return repo.obter_ativo()


# --- Gestão (só admin) ---------------------------------------------------------
# Protegido por `obter_utilizador_admin` (401 sem sessão, 403 se não-admin).
# Sem service: criar/editar/apagar um banner é gestão de conteúdo, não decide
# acesso, dinheiro nem resultado clínico (ver CLAUDE.md secção 3).


@router.get("", response_model=list[BannerAdmin], dependencies=[Depends(obter_utilizador_admin)])
def listar_banners(
    repo: SQLAlchemyBannersRepository = Depends(obter_banners_repository),
) -> list[BannerRegisto]:
    return repo.listar()


@router.post(
    "",
    response_model=BannerAdmin,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(obter_utilizador_admin)],
)
def criar_banner(
    dados: BannerCriar,
    repo: SQLAlchemyBannersRepository = Depends(obter_banners_repository),
) -> BannerRegisto:
    return repo.criar(dados.titulo, dados.mensagem, dados.link, dados.ativo)


@router.patch(
    "/{banner_id}",
    response_model=BannerAdmin,
    dependencies=[Depends(obter_utilizador_admin)],
)
def atualizar_banner(
    banner_id: str,
    dados: BannerAtualizar,
    repo: SQLAlchemyBannersRepository = Depends(obter_banners_repository),
) -> BannerRegisto:
    registo = repo.atualizar(banner_id, BannerPatch(**dados.model_dump(exclude_unset=True)))
    if registo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="banner não encontrado")
    return registo


@router.delete(
    "/{banner_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(obter_utilizador_admin)],
)
def apagar_banner(
    banner_id: str,
    repo: SQLAlchemyBannersRepository = Depends(obter_banners_repository),
) -> None:
    if not repo.apagar(banner_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="banner não encontrado")
