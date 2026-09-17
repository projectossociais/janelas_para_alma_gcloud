"""Upload da imagem do banner-imagem da homepage -- mesmo padrão de
`publicacao_midia_service.py`/`upload_service.py`: a API só assina um URL
de `PUT`, o browser envia os bytes directamente ao R2, e só depois a API
confirma que a chave pertence mesmo a este banner antes de a gravar.
"""

import uuid
from dataclasses import dataclass
from typing import Protocol

from app.core.config import obter_settings
from app.repositories.storage import Presigner

EXTENSAO_POR_CONTENT_TYPE = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
}


class TipoDeFicheiroNaoPermitidoError(Exception):
    pass


class ChaveDeImagemInvalidaError(Exception):
    """A chave a confirmar não pertence a este banner."""


class BannerHomepageImagemRepository(Protocol):
    def definir_imagem_url(self, banner_id: str, url: str) -> None: ...


@dataclass(frozen=True)
class ImagemPreparada:
    url_de_upload: str
    chave: str
    url_publico: str


class BannerHomepageUploadService:
    def __init__(self, presigner: Presigner, banners: BannerHomepageImagemRepository) -> None:
        self._presigner = presigner
        self._banners = banners

    def _prefixo(self, banner_id: str) -> str:
        return f"banners-homepage/{banner_id}/"

    def _url_publico(self, chave: str) -> str:
        base = obter_settings().r2_public_base_url.rstrip("/")
        return f"{base}/{chave}"

    def preparar(self, banner_id: str, content_type: str) -> ImagemPreparada:
        extensao = EXTENSAO_POR_CONTENT_TYPE.get(content_type)
        if extensao is None:
            raise TipoDeFicheiroNaoPermitidoError(content_type)

        chave = f"{self._prefixo(banner_id)}{uuid.uuid4()}.{extensao}"
        return ImagemPreparada(
            url_de_upload=self._presigner.url_de_upload(chave, content_type),
            chave=chave,
            url_publico=self._url_publico(chave),
        )

    def confirmar(self, banner_id: str, chave: str) -> str:
        if not chave.startswith(self._prefixo(banner_id)):
            raise ChaveDeImagemInvalidaError(chave)

        url = self._url_publico(chave)
        self._banners.definir_imagem_url(banner_id, url)
        return url
