"""Validação instantânea do comprovativo do Premium (PDF ou captura de ecrã,
de qualquer banco angolano ou do Multicaixa Express) e o painel de
auditoria dos admins.

Toda a decisão vive no `ValidacaoComprovativoService` (CLAUDE.md §3/§10); aqui
só se traduz para HTTP:

- aprovado → 200, revisão manual → 202
- rejeitado → 422, ou 409 quando é "já foi usado" -- sempre com `detail`
  (a mensagem para o utilizador) e `codigo` (estável, para a interface).
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.core.config import obter_settings
from app.core.dependencies import obter_utilizador_admin, obter_utilizador_atual
from app.core.ocr import TesseractLeitorOcr
from app.db import obter_sessao
from app.repositories.admin_repository import SQLAlchemyAdminRepository
from app.repositories.comprovativos_pagamento_repository import (
    ComprovativoRegisto,
    SQLAlchemyComprovativosPagamentoRepository,
)
from app.repositories.notification_repository import SQLAlchemyNotificationRepository
from app.repositories.orm_models import ESTADOS_COMPROVATIVO_PAGAMENTO
from app.repositories.storage import R2ComprovativosStorage
from app.repositories.utilizadores_repository import UtilizadorRegisto
from app.schemas.pagamentos import (
    ComprovativoAdmin,
    ComprovativoAdminDetalhe,
    DecisaoComMotivo,
    PrepararUploadComprovativo,
    ResultadoValidacao,
    UploadComprovativoPreparado,
    UrlFicheiro,
    ValidarComprovativoPedido,
)
from app.services.validacao_comprovativo_service import (
    CODIGOS_DUPLICADO,
    ESTADO_APROVADO,
    ESTADO_REVISAO,
    ChaveDeComprovativoInvalidaError,
    ComprovativoInexistenteError,
    ComprovativoJaContaError,
    ConfigPagamento,
    DecisaoInvalidaError,
    FicheiroNaoEnviadoError,
    TipoDeFicheiroNaoPermitidoError,
    ValidacaoComprovativoService,
    ValidacaoIndisponivelError,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/pagamentos/comprovativos", tags=["pagamentos"])
router_admin = APIRouter(
    prefix="/admin/comprovativos-pagamento",
    tags=["admin"],
    dependencies=[Depends(obter_utilizador_admin)],
)

_INDISPONIVEL = "a validação automática de comprovativos ainda não está disponível"


class NotificadorAdminsNaApp:
    """Avisa todos os admins por notificação na app (sino do painel)."""

    def __init__(self, sessao: Session) -> None:
        self._admins = SQLAlchemyAdminRepository(sessao)
        self._notificacoes = SQLAlchemyNotificationRepository(sessao)

    def notificar(self, titulo: str, mensagem: str) -> None:
        ids = [a.id for a in self._admins.listar(papel="admin")]
        if ids:
            self._notificacoes.criar_em_massa(ids, titulo, mensagem)


def obter_validacao_service(sessao: Session = Depends(obter_sessao)) -> ValidacaoComprovativoService:
    settings = obter_settings()
    if not settings.r2_bucket_comprovativos:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=_INDISPONIVEL)
    return ValidacaoComprovativoService(
        SQLAlchemyComprovativosPagamentoRepository(sessao),
        R2ComprovativosStorage(),
        ConfigPagamento.das_settings(settings),
        NotificadorAdminsNaApp(sessao),
        ocr=TesseractLeitorOcr(settings.ocr_idiomas),
    )


def obter_comprovativos_repository(
    sessao: Session = Depends(obter_sessao),
) -> SQLAlchemyComprovativosPagamentoRepository:
    return SQLAlchemyComprovativosPagamentoRepository(sessao)


@router.post("/upload", response_model=UploadComprovativoPreparado)
def preparar_upload(
    dados: PrepararUploadComprovativo,
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    servico: ValidacaoComprovativoService = Depends(obter_validacao_service),
):
    try:
        return servico.preparar_upload(utilizador.id, dados.content_type)
    except ValidacaoIndisponivelError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=_INDISPONIVEL) from exc
    except TipoDeFicheiroNaoPermitidoError as exc:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="tipo de ficheiro não permitido (PDF, PNG, JPEG ou WebP)",
        ) from exc


@router.post(
    "/validar",
    response_model=ResultadoValidacao,
    responses={202: {"model": ResultadoValidacao}, 409: {}, 422: {}},
)
def validar_comprovativo(
    dados: ValidarComprovativoPedido,
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    servico: ValidacaoComprovativoService = Depends(obter_validacao_service),
):
    try:
        registo = servico.validar(utilizador.id, dados.chave)
    except ValidacaoIndisponivelError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=_INDISPONIVEL) from exc
    except ChaveDeComprovativoInvalidaError as exc:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, detail="essa chave não é um comprovativo seu"
        ) from exc
    except FicheiroNaoEnviadoError as exc:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, detail="o ficheiro do comprovativo não chegou -- envie-o outra vez"
        ) from exc

    corpo = ResultadoValidacao.model_validate(registo).model_dump(mode="json")
    if registo.estado == ESTADO_APROVADO:
        return JSONResponse(corpo, status_code=status.HTTP_200_OK)
    if registo.estado == ESTADO_REVISAO:
        return JSONResponse(corpo, status_code=status.HTTP_202_ACCEPTED)
    codigo_http = (
        status.HTTP_409_CONFLICT
        if registo.motivo_codigo in CODIGOS_DUPLICADO
        else status.HTTP_422_UNPROCESSABLE_CONTENT
    )
    return JSONResponse(
        {"detail": registo.motivo, "codigo": registo.motivo_codigo, "comprovativo_id": registo.id},
        status_code=codigo_http,
    )


# --- admin ---------------------------------------------------------------------


@router_admin.get("", response_model=list[ComprovativoAdmin])
def listar(
    estado: str | None = Query(default=None),
    repo: SQLAlchemyComprovativosPagamentoRepository = Depends(obter_comprovativos_repository),
) -> list[ComprovativoRegisto]:
    if estado is not None and estado not in ESTADOS_COMPROVATIVO_PAGAMENTO:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, detail="estado desconhecido")
    return repo.listar(estado)


@router_admin.get("/{comprovativo_id}", response_model=ComprovativoAdminDetalhe)
def obter(
    comprovativo_id: str,
    repo: SQLAlchemyComprovativosPagamentoRepository = Depends(obter_comprovativos_repository),
) -> ComprovativoRegisto:
    registo = repo.obter(comprovativo_id)
    if registo is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="comprovativo não encontrado")
    return registo


def _decidir(accao):
    try:
        return accao()
    except ComprovativoInexistenteError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="comprovativo não encontrado") from exc
    except DecisaoInvalidaError as exc:
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail=f"não é possível fazer isso a um comprovativo {exc}"
        ) from exc
    except ComprovativoJaContaError as exc:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="este ficheiro ou esta operação já contam noutro comprovativo",
        ) from exc


@router_admin.get("/{comprovativo_id}/ficheiro", response_model=UrlFicheiro)
def url_do_ficheiro(
    comprovativo_id: str,
    servico: ValidacaoComprovativoService = Depends(obter_validacao_service),
) -> dict:
    return {"url": _decidir(lambda: servico.url_do_ficheiro(comprovativo_id))}


@router_admin.post("/{comprovativo_id}/aprovar", response_model=ComprovativoAdmin)
def aprovar(
    comprovativo_id: str,
    admin: UtilizadorRegisto = Depends(obter_utilizador_admin),
    servico: ValidacaoComprovativoService = Depends(obter_validacao_service),
) -> ComprovativoRegisto:
    return _decidir(lambda: servico.aprovar_manualmente(comprovativo_id, admin.id))


@router_admin.post("/{comprovativo_id}/rejeitar", response_model=ComprovativoAdmin)
def rejeitar(
    comprovativo_id: str,
    dados: DecisaoComMotivo,
    admin: UtilizadorRegisto = Depends(obter_utilizador_admin),
    servico: ValidacaoComprovativoService = Depends(obter_validacao_service),
) -> ComprovativoRegisto:
    return _decidir(lambda: servico.rejeitar_manualmente(comprovativo_id, admin.id, dados.motivo))


@router_admin.post("/{comprovativo_id}/revogar", response_model=ComprovativoAdmin)
def revogar(
    comprovativo_id: str,
    dados: DecisaoComMotivo,
    admin: UtilizadorRegisto = Depends(obter_utilizador_admin),
    servico: ValidacaoComprovativoService = Depends(obter_validacao_service),
) -> ComprovativoRegisto:
    return _decidir(lambda: servico.revogar(comprovativo_id, admin.id, dados.motivo))
