"""Regras do upload de avatar.

Há aqui lógica de negócio de verdade (por isso é um service, com testes, e
não um router fino — ver CLAUDE.md secção 3): o utilizador podia mentir
sobre o tipo de ficheiro e sobre de quem é a chave que manda confirmar.
Ambas as coisas são recusadas aqui, não escondidas na interface.

O fluxo tem dois passos, de propósito:
  1. `preparar_avatar` — a API assina um URL de `PUT` para uma chave que
     ela própria escolhe (`avatares/{utilizador_id}/{uuid}.{ext}`). O
     browser envia os bytes directamente ao R2; a API nunca os vê.
  2. `confirmar_avatar` — só depois de o `PUT` ter corrido, o browser diz
     "está lá". A API confirma que a chave começa pelo prefixo do próprio
     utilizador antes de a gravar em `utilizadores.avatar_url`.
"""

import uuid
from dataclasses import dataclass
from typing import Protocol

from app.core.config import obter_settings
from app.repositories.storage import Presigner

# `image/jpg` não é um media type válido — o correcto é `image/jpeg`.
EXTENSAO_POR_CONTENT_TYPE = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
}


class TipoDeFicheiroNaoPermitidoError(Exception):
    """Content-type fora da lista de imagens aceites."""


class ChaveDeAvatarInvalidaError(Exception):
    """A chave a confirmar não pertence ao utilizador que a envia."""


class AvatarRepository(Protocol):
    def definir_avatar_url(self, utilizador_id: str, url: str | None) -> None: ...


@dataclass(frozen=True)
class AvatarPreparado:
    url_de_upload: str
    chave: str
    url_publico: str


class UploadService:
    def __init__(self, presigner: Presigner, avatares: AvatarRepository) -> None:
        self._presigner = presigner
        self._avatares = avatares

    def _prefixo(self, utilizador_id: str) -> str:
        return f"avatares/{utilizador_id}/"

    def _url_publico(self, chave: str) -> str:
        base = obter_settings().r2_public_base_url.rstrip("/")
        return f"{base}/{chave}"

    def preparar_avatar(self, utilizador_id: str, content_type: str) -> AvatarPreparado:
        extensao = EXTENSAO_POR_CONTENT_TYPE.get(content_type)
        if extensao is None:
            raise TipoDeFicheiroNaoPermitidoError(content_type)

        chave = f"{self._prefixo(utilizador_id)}{uuid.uuid4()}.{extensao}"
        return AvatarPreparado(
            url_de_upload=self._presigner.url_de_upload(chave, content_type),
            chave=chave,
            url_publico=self._url_publico(chave),
        )

    def confirmar_avatar(self, utilizador_id: str, chave: str) -> str:
        if not chave.startswith(self._prefixo(utilizador_id)):
            raise ChaveDeAvatarInvalidaError(chave)

        url_publico = self._url_publico(chave)
        self._avatares.definir_avatar_url(utilizador_id, url_publico)
        return url_publico
