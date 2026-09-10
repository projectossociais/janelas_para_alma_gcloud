from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import obter_utilizador_atual
from app.db import obter_sessao
from app.repositories.perfil_repository import SQLAlchemyPerfilRepository
from app.repositories.storage import R2Presigner
from app.repositories.utilizadores_repository import UtilizadorRegisto
from app.schemas.upload import (
    AvatarConfirmado,
    AvatarConfirmar,
    AvatarUploadPedido,
    AvatarUploadPreparado,
)
from app.services.upload_service import (
    ChaveDeAvatarInvalidaError,
    TipoDeFicheiroNaoPermitidoError,
    UploadService,
)

router = APIRouter(prefix="/uploads", tags=["uploads"])


def obter_upload_service(sessao: Session = Depends(obter_sessao)) -> UploadService:
    return UploadService(R2Presigner(), SQLAlchemyPerfilRepository(sessao))


@router.post("/avatar", response_model=AvatarUploadPreparado)
def preparar_upload_de_avatar(
    pedido: AvatarUploadPedido,
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    servico: UploadService = Depends(obter_upload_service),
) -> AvatarUploadPreparado:
    """Devolve um URL de `PUT` assinado para o browser enviar o ficheiro
    directamente ao R2. Os bytes nunca passam por esta API."""
    try:
        preparado = servico.preparar_avatar(utilizador.id, pedido.content_type)
    except TipoDeFicheiroNaoPermitidoError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="tipo de ficheiro não permitido (só PNG, JPEG ou WebP)",
        ) from exc
    return AvatarUploadPreparado(**preparado.__dict__)


@router.post("/avatar/confirmar", response_model=AvatarConfirmado)
def confirmar_upload_de_avatar(
    pedido: AvatarConfirmar,
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    servico: UploadService = Depends(obter_upload_service),
) -> AvatarConfirmado:
    """Chamado pelo browser depois do `PUT` ter corrido. Grava a chave em
    `avatar_url` — mas só se ela pertencer a este utilizador."""
    try:
        url = servico.confirmar_avatar(utilizador.id, pedido.chave)
    except ChaveDeAvatarInvalidaError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="essa chave não pertence a este utilizador",
        ) from exc
    return AvatarConfirmado(avatar_url=url)
