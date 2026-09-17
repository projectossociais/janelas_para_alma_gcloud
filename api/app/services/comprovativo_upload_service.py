"""Upload de comprovativos de pagamento/transferência (CROSS-02) — mesmo
padrão de três passos do avatar (`upload_service.py`) e das fotos de
publicações (`publicacao_midia_service.py`): a API só assina um URL de
`PUT`, o browser envia os bytes directamente ao R2.

Diferença deliberada em relação ao avatar: aqui não há "dono" a validar no
momento da preparação — quem doa ou pede Premium pode não ter sessão
nenhuma. A chave nasce sob um prefixo fixo (`comprovativos/`) só para se
poder confirmar, no momento de criar a doação/pedido, que a chave
apresentada é mesmo um comprovativo e não um caminho arbitrário dentro do
bucket (ver `doacao_service.py`/`premium_service.py`)."""

import uuid
from dataclasses import dataclass

from app.core.config import obter_settings
from app.repositories.storage import Presigner

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


@dataclass(frozen=True)
class ComprovativoPreparado:
    url_de_upload: str
    chave: str
    url_publico: str


def url_publico_do_comprovativo(chave: str) -> str:
    """Valida o prefixo e devolve o URL público -- usado por quem cria a
    doação/pedido depois do upload já ter corrido."""
    if not chave.startswith(PREFIXO_COMPROVATIVOS):
        raise ChaveDeComprovativoInvalidaError(chave)
    base = obter_settings().r2_public_base_url.rstrip("/")
    return f"{base}/{chave}"


class ComprovativoUploadService:
    def __init__(self, presigner: Presigner) -> None:
        self._presigner = presigner

    def preparar(self, content_type: str) -> ComprovativoPreparado:
        extensao = EXTENSAO_POR_CONTENT_TYPE.get(content_type)
        if extensao is None:
            raise TipoDeFicheiroNaoPermitidoError(content_type)

        chave = f"{PREFIXO_COMPROVATIVOS}{uuid.uuid4()}.{extensao}"
        return ComprovativoPreparado(
            url_de_upload=self._presigner.url_de_upload(chave, content_type),
            chave=chave,
            url_publico=url_publico_do_comprovativo(chave),
        )
