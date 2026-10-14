"""Upload de comprovativos de pagamento/transferência (CROSS-02) — mesmo
padrão de três passos do avatar (`upload_service.py`): a API só assina um
URL de `PUT`, o browser envia os bytes directamente ao R2.

Diferenças deliberadas em relação ao avatar:

- Não há "dono" a validar no momento da preparação — quem doa ou pede
  Premium pode não ter sessão nenhuma. A chave nasce sob um prefixo fixo
  (`comprovativos/`) só para se poder confirmar, no momento de criar a
  doação/pedido, que a chave apresentada é mesmo um comprovativo e não um
  caminho arbitrário (ver `doacao_service.py`/`premium_service.py`/
  `loja_jogo_service.py`).
- O bucket é **privado** (`r2_bucket_comprovativos`), nunca o público: são
  comprovativos bancários, com o nome e a conta de quem pagou. Grava-se a
  chave, nunca um URL; um admin lê o ficheiro por um URL assinado de vida
  curta (`comprovativo_leitura_service.py`). Sem o bucket privado
  configurado, o upload é recusado — nunca cai para o bucket público.
  Até 2026-10-14 iam para o bucket público, com o URL gravado em
  `comprovativo_url`; ver `migracao_comprovativos_service.py`."""

import uuid
from dataclasses import dataclass

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


class ArmazenamentoPrivadoIndisponivelError(Exception):
    """O bucket privado dos comprovativos não está configurado."""


@dataclass(frozen=True)
class ComprovativoPreparado:
    url_de_upload: str
    chave: str


def chave_de_comprovativo_valida(chave: str) -> bool:
    return chave.startswith(PREFIXO_COMPROVATIVOS) and ".." not in chave and len(chave) > len(PREFIXO_COMPROVATIVOS)


def validar_chave_de_comprovativo(chave: str) -> str:
    """Confirma que a chave é mesmo um comprovativo e devolve-a -- usado por
    quem cria a doação/pedido depois do upload já ter corrido."""
    if not chave_de_comprovativo_valida(chave):
        raise ChaveDeComprovativoInvalidaError(chave)
    return chave


class ComprovativoUploadService:
    def __init__(self, presigner: Presigner | None) -> None:
        # `None` = bucket privado por configurar (ver
        # `R2ComprovativosStorage.se_configurado`).
        self._presigner = presigner

    def preparar(self, content_type: str) -> ComprovativoPreparado:
        extensao = EXTENSAO_POR_CONTENT_TYPE.get(content_type)
        if extensao is None:
            raise TipoDeFicheiroNaoPermitidoError(content_type)
        if self._presigner is None:
            raise ArmazenamentoPrivadoIndisponivelError()

        chave = f"{PREFIXO_COMPROVATIVOS}{uuid.uuid4()}.{extensao}"
        return ComprovativoPreparado(
            url_de_upload=self._presigner.url_de_upload(chave, content_type),
            chave=chave,
        )
