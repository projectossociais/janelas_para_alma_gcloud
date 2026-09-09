from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import obter_sessao
from app.repositories.banners_repository import BannerRegisto, SQLAlchemyBannersRepository
from app.schemas.banner import BannerPublico

router = APIRouter(prefix="/banners", tags=["banners"])


def obter_banners_repository(sessao: Session = Depends(obter_sessao)) -> SQLAlchemyBannersRepository:
    return SQLAlchemyBannersRepository(sessao)


@router.get("/ativo", response_model=BannerPublico | None)
def obter_banner_ativo(
    repo: SQLAlchemyBannersRepository = Depends(obter_banners_repository),
) -> BannerRegisto | None:
    return repo.obter_ativo()
