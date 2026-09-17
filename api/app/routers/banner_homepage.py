from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import obter_utilizador_admin
from app.db import obter_sessao
from app.repositories.banner_homepage_repository import (
    BannerHomepagePatch,
    BannerHomepageRegisto,
    SQLAlchemyBannerHomepageRepository,
)
from app.repositories.storage import R2Presigner
from app.schemas.banner_homepage import (
    BannerHomepageAdmin,
    BannerHomepageAtualizar,
    BannerHomepageCriar,
    BannerHomepagePublico,
    ImagemConfirmada,
    ImagemConfirmar,
    ImagemUploadPedido,
    ImagemUploadPreparado,
)
from app.services.banner_homepage_upload_service import (
    BannerHomepageUploadService,
    ChaveDeImagemInvalidaError,
    TipoDeFicheiroNaoPermitidoError,
)

router = APIRouter(prefix="/banners-homepage", tags=["banner-homepage"])


def obter_banner_homepage_repository(
    sessao: Session = Depends(obter_sessao),
) -> SQLAlchemyBannerHomepageRepository:
    return SQLAlchemyBannerHomepageRepository(sessao)


def obter_banner_homepage_upload_service(
    sessao: Session = Depends(obter_sessao),
) -> BannerHomepageUploadService:
    return BannerHomepageUploadService(R2Presigner(), SQLAlchemyBannerHomepageRepository(sessao))


@router.get("/ativo", response_model=BannerHomepagePublico | None)
def obter_banner_homepage_ativo(
    repo: SQLAlchemyBannerHomepageRepository = Depends(obter_banner_homepage_repository),
) -> BannerHomepageRegisto | None:
    return repo.obter_ativo()


# --- Gestão (só admin) ---------------------------------------------------------
# Mesma nota de banners.py: sem service para o CRUD simples (gestão de
# conteúdo, protegida pela dependency, não uma regra de negócio). O upload
# da imagem é que tem regra a proteger (a chave tem de ser deste banner),
# por isso vive num service à parte.


@router.get(
    "",
    response_model=list[BannerHomepageAdmin],
    dependencies=[Depends(obter_utilizador_admin)],
)
def listar_banners_homepage(
    repo: SQLAlchemyBannerHomepageRepository = Depends(obter_banner_homepage_repository),
) -> list[BannerHomepageRegisto]:
    return repo.listar()


@router.post(
    "",
    response_model=BannerHomepageAdmin,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(obter_utilizador_admin)],
)
def criar_banner_homepage(
    dados: BannerHomepageCriar,
    repo: SQLAlchemyBannerHomepageRepository = Depends(obter_banner_homepage_repository),
) -> BannerHomepageRegisto:
    return repo.criar(dados.titulo, dados.descricao, dados.link, dados.ativo)


@router.patch(
    "/{banner_id}",
    response_model=BannerHomepageAdmin,
    dependencies=[Depends(obter_utilizador_admin)],
)
def atualizar_banner_homepage(
    banner_id: str,
    dados: BannerHomepageAtualizar,
    repo: SQLAlchemyBannerHomepageRepository = Depends(obter_banner_homepage_repository),
) -> BannerHomepageRegisto:
    registo = repo.atualizar(banner_id, BannerHomepagePatch(**dados.model_dump(exclude_unset=True)))
    if registo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="banner não encontrado")
    return registo


@router.delete(
    "/{banner_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(obter_utilizador_admin)],
)
def apagar_banner_homepage(
    banner_id: str,
    repo: SQLAlchemyBannerHomepageRepository = Depends(obter_banner_homepage_repository),
) -> None:
    if not repo.apagar(banner_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="banner não encontrado")


@router.post(
    "/{banner_id}/imagem/preparar",
    response_model=ImagemUploadPreparado,
    dependencies=[Depends(obter_utilizador_admin)],
)
def preparar_imagem(
    banner_id: str,
    pedido: ImagemUploadPedido,
    servico: BannerHomepageUploadService = Depends(obter_banner_homepage_upload_service),
) -> ImagemUploadPreparado:
    try:
        preparada = servico.preparar(banner_id, pedido.content_type)
    except TipoDeFicheiroNaoPermitidoError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="tipo de ficheiro não permitido (só PNG, JPEG ou WebP)",
        ) from exc
    return ImagemUploadPreparado(**preparada.__dict__)


@router.post(
    "/{banner_id}/imagem/confirmar",
    response_model=ImagemConfirmada,
    dependencies=[Depends(obter_utilizador_admin)],
)
def confirmar_imagem(
    banner_id: str,
    pedido: ImagemConfirmar,
    servico: BannerHomepageUploadService = Depends(obter_banner_homepage_upload_service),
) -> ImagemConfirmada:
    try:
        url = servico.confirmar(banner_id, pedido.chave)
    except ChaveDeImagemInvalidaError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="essa chave não pertence a este banner",
        ) from exc
    return ImagemConfirmada(imagem_url=url)
