"""Como um admin abre um comprovativo de pagamento (Premium, doação, loja
do jogo).

Os comprovativos são bancários — nome e conta de quem pagou — e vivem num
bucket R2 privado (`comprovativo_upload_service.py`). Nunca se guarda nem se
expõe um URL permanente: a cada pedido, emite-se um `GET` assinado de vida
curta (`r2_comprovativo_url_expira_segundos`).

Comprovativos antigos (anteriores a 2026-10-14, ainda com o URL público em
`comprovativo_url`) continuam legíveis por esse URL até
`scripts/migrar_comprovativos_privados.py` os copiar para o bucket privado.

Quem pode pedir isto (só admin) decide o router, com
`Depends(obter_utilizador_admin)` — este service não sabe o que é HTTP."""

from dataclasses import dataclass
from typing import Protocol

from app.repositories.comprovativos_repository import OrigemComprovativo, ReferenciaComprovativo
from app.services.comprovativo_upload_service import (
    ArmazenamentoPrivadoIndisponivelError,
    chave_de_comprovativo_valida,
)

__all__ = [
    "ArmazenamentoPrivadoIndisponivelError",
    "ComprovativoLeituraService",
    "ComprovativoNaoEncontradoError",
    "ComprovativoParaLer",
    "ReferenciaComprovativo",
]


class ComprovativoNaoEncontradoError(Exception):
    """O registo não existe, não tem comprovativo, ou a referência não é
    um comprovativo nosso."""


class ComprovativosRepository(Protocol):
    def obter_referencia(
        self, origem: OrigemComprovativo, registo_id: str
    ) -> ReferenciaComprovativo | None: ...


class LeitorComprovativos(Protocol):
    def url_de_leitura(self, chave: str) -> str: ...


@dataclass(frozen=True)
class ComprovativoParaLer:
    url: str
    # `None` = URL público antigo, sem expiração (por migrar).
    expira_em_segundos: int | None


class ComprovativoLeituraService:
    def __init__(
        self,
        repositorio: ComprovativosRepository,
        leitor: LeitorComprovativos | None,
        expira_em_segundos: int,
    ) -> None:
        # `leitor` é `None` sem o bucket privado configurado.
        self._repo = repositorio
        self._leitor = leitor
        self._expira = expira_em_segundos

    def url_para_admin(self, origem: OrigemComprovativo, registo_id: str) -> ComprovativoParaLer:
        referencia = self._repo.obter_referencia(origem, registo_id)
        if referencia is None:
            raise ComprovativoNaoEncontradoError(registo_id)

        if referencia.chave:
            # Nunca assinar uma chave fora do prefixo: o endpoint não pode
            # virar um assinador de leitura para qualquer objecto do bucket.
            if not chave_de_comprovativo_valida(referencia.chave):
                raise ComprovativoNaoEncontradoError(registo_id)
            if self._leitor is None:
                raise ArmazenamentoPrivadoIndisponivelError()
            return ComprovativoParaLer(
                url=self._leitor.url_de_leitura(referencia.chave), expira_em_segundos=self._expira
            )

        if referencia.url_legado:
            return ComprovativoParaLer(url=referencia.url_legado, expira_em_segundos=None)

        raise ComprovativoNaoEncontradoError(registo_id)
