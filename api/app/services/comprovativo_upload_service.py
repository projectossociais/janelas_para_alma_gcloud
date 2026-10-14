"""Upload de comprovativos de pagamento/transferência (CROSS-02) — mesmo
padrão de três passos do avatar (`upload_service.py`) e das fotos de
publicações (`publicacao_midia_service.py`): a API só assina um URL de
`PUT`, o browser envia os bytes directamente ao R2.

Diferença deliberada em relação ao avatar: aqui não há "dono" a validar no
momento da preparação — quem doa ou pede Premium pode não ter sessão
nenhuma. A chave nasce sob um prefixo fixo (`comprovativos/`) só para se
poder confirmar, no momento de criar a doação/pedido, que a chave
apresentada é mesmo um comprovativo e não um caminho arbitrário dentro do
bucket (ver `doacao_service.py`/`premium_service.py`/`loja_jogo_service.py`).

**Bucket privado (desde 2026-10-14).** Um comprovativo tem o nome e a conta
de quem pagou -- não pode ficar no bucket público. Com
`r2_bucket_comprovativos` configurado, o upload vai para esse bucket
privado e a coluna `comprovativo_url` passa a guardar a **chave**
(`comprovativos/<uuid>.pdf`), nunca um URL; um admin vê o ficheiro por um
URL assinado de curta duração (`url_de_leitura_do_comprovativo`). As linhas
antigas guardam o URL público de antes e continuam a abrir tal como estão
-- nenhum registo antigo é reescrito. Sem o bucket privado configurado
(desenvolvimento local), fica o comportamento antigo.
"""

import logging
import uuid
from dataclasses import dataclass
from typing import Protocol

from app.core.config import obter_settings
from app.repositories.storage import Presigner

logger = logging.getLogger(__name__)

PREFIXO_COMPROVATIVOS = "comprovativos/"

EXTENSAO_POR_CONTENT_TYPE = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "application/pdf": "pdf",
}


class TipoDeFicheiroNaoPermitidoError(Exception):
    pass


class ChaveDeComprovativoInvalidaError(Exception):
    """A chave apresentada não está sob o prefixo `comprovativos/` -- nunca
    aceitar um caminho arbitrário do bucket como se fosse um comprovativo."""


class PresignerDeLeitura(Protocol):
    def url_de_leitura(self, chave: str) -> str: ...


@dataclass(frozen=True)
class ComprovativoPreparado:
    url_de_upload: str
    chave: str
    # Só no modo antigo (bucket público). Com o bucket privado não existe
    # URL público -- e é esse o objectivo.
    url_publico: str | None


def bucket_privado_configurado() -> bool:
    return bool(obter_settings().r2_bucket_comprovativos)


def _validar_chave(chave: str) -> None:
    if not chave.startswith(PREFIXO_COMPROVATIVOS) or ".." in chave:
        raise ChaveDeComprovativoInvalidaError(chave)


def _url_publico(chave: str) -> str:
    base = obter_settings().r2_public_base_url.rstrip("/")
    return f"{base}/{chave}"


def referencia_do_comprovativo(chave: str) -> str:
    """O que se grava em `comprovativo_url` depois do upload: a chave no
    bucket privado ou, sem ele configurado, o URL público (modo antigo).
    Valida sempre o prefixo primeiro."""
    _validar_chave(chave)
    if bucket_privado_configurado():
        return chave
    logger.warning(
        "R2_BUCKET_COMPROVATIVOS vazio: o comprovativo %s fica no bucket público", chave
    )
    return _url_publico(chave)


def url_de_leitura_do_comprovativo(referencia: str, presigner: PresignerDeLeitura) -> str:
    """URL para um admin abrir o comprovativo guardado em `comprovativo_url`.

    - chave do bucket privado (`comprovativos/...`) → URL assinado, curto;
    - URL público antigo (de antes do bucket privado) → o próprio URL;
    - qualquer outra coisa → recusado (nunca um caminho arbitrário)."""
    if referencia.startswith(("http://", "https://")):
        base = obter_settings().r2_public_base_url.rstrip("/")
        if base and referencia.startswith(f"{base}/{PREFIXO_COMPROVATIVOS}") and ".." not in referencia:
            return referencia
        raise ChaveDeComprovativoInvalidaError(referencia)
    _validar_chave(referencia)
    return presigner.url_de_leitura(referencia)


class ComprovativoUploadService:
    def __init__(self, presigner: Presigner, privado: bool | None = None) -> None:
        self._presigner = presigner
        self._privado = bucket_privado_configurado() if privado is None else privado

    def preparar(self, content_type: str) -> ComprovativoPreparado:
        extensao = EXTENSAO_POR_CONTENT_TYPE.get(content_type)
        if extensao is None:
            raise TipoDeFicheiroNaoPermitidoError(content_type)

        chave = f"{PREFIXO_COMPROVATIVOS}{uuid.uuid4()}.{extensao}"
        return ComprovativoPreparado(
            url_de_upload=self._presigner.url_de_upload(chave, content_type),
            chave=chave,
            url_publico=None if self._privado else _url_publico(chave),
        )
