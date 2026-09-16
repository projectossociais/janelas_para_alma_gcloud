"""Upload de fotos de uma publicação (capa + galeria) — mesmo padrão de
`upload_service.py` (avatar): a API só assina um URL de `PUT`, o browser
envia os bytes directamente ao R2, e só depois a API confirma que a chave
pertence mesmo a esta publicação antes de a gravar. Nunca os bytes de uma
foto passam pela nossa API.
"""

import uuid
from dataclasses import dataclass
from typing import Protocol

from app.core.config import obter_settings
from app.repositories.publicacoes_repository import MidiaRegisto
from app.repositories.storage import Presigner

EXTENSAO_POR_CONTENT_TYPE = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
}


class TipoDeFicheiroNaoPermitidoError(Exception):
    pass


class ChaveDeMidiaInvalidaError(Exception):
    """A chave a confirmar não pertence a esta publicação."""


class PublicacoesMidiaRepository(Protocol):
    def definir_capa(self, publicacao_id: str, url: str) -> None: ...
    def adicionar_midia(self, publicacao_id: str, url: str) -> MidiaRegisto: ...
    def remover_midia(self, midia_id: str) -> None: ...


@dataclass(frozen=True)
class MidiaPreparada:
    url_de_upload: str
    chave: str
    url_publico: str


class PublicacaoMidiaService:
    def __init__(self, presigner: Presigner, publicacoes: PublicacoesMidiaRepository) -> None:
        self._presigner = presigner
        self._publicacoes = publicacoes

    def _prefixo(self, publicacao_id: str) -> str:
        return f"publicacoes/{publicacao_id}/"

    def _url_publico(self, chave: str) -> str:
        base = obter_settings().r2_public_base_url.rstrip("/")
        return f"{base}/{chave}"

    def preparar(self, publicacao_id: str, content_type: str) -> MidiaPreparada:
        extensao = EXTENSAO_POR_CONTENT_TYPE.get(content_type)
        if extensao is None:
            raise TipoDeFicheiroNaoPermitidoError(content_type)

        chave = f"{self._prefixo(publicacao_id)}{uuid.uuid4()}.{extensao}"
        return MidiaPreparada(
            url_de_upload=self._presigner.url_de_upload(chave, content_type),
            chave=chave,
            url_publico=self._url_publico(chave),
        )

    def confirmar_capa(self, publicacao_id: str, chave: str) -> str:
        if not chave.startswith(self._prefixo(publicacao_id)):
            raise ChaveDeMidiaInvalidaError(chave)

        url = self._url_publico(chave)
        self._publicacoes.definir_capa(publicacao_id, url)
        return url

    def confirmar_midia(self, publicacao_id: str, chave: str) -> MidiaRegisto:
        if not chave.startswith(self._prefixo(publicacao_id)):
            raise ChaveDeMidiaInvalidaError(chave)

        url = self._url_publico(chave)
        return self._publicacoes.adicionar_midia(publicacao_id, url)

    def remover_midia(self, midia_id: str) -> None:
        self._publicacoes.remover_midia(midia_id)
