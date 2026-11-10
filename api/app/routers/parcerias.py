"""Registo de parceiros (`/parceiros/registo` no site). Público de propósito:
uma clínica, óptica ou organização que se quer juntar à rede ainda não tem
conta. As regras vivem no `CandidaturaParceriaService`."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import obter_settings
from app.core.dependencies import obter_email_sender
from app.core.email import EmailSender
from app.db import obter_sessao
from app.repositories.candidatura_parceria_repository import SQLAlchemyCandidaturaParceriaRepository
from app.repositories.storage import R2ComprovativosStorage
from app.schemas.parceria import (
    CandidaturaParceriaCriar,
    CandidaturaParceriaPublica,
    DocumentoParceriaPedido,
    DocumentoParceriaPreparado,
)
from app.services.candidatura_parceria_service import (
    CandidaturaParceriaService,
    ChaveDeDocumentoInvalidaError,
    DadosCandidaturaParceria,
    DemasiadosDocumentosError,
    DocumentoParceria,
    DocumentosIndisponiveisError,
    TipoDeDocumentoNaoPermitidoError,
)

router = APIRouter(prefix="/parcerias", tags=["parcerias"])

_SEM_DOCUMENTOS = "o envio de documentos está temporariamente indisponível"
_TIPO_INVALIDO = "tipo de ficheiro não permitido (PDF, PNG ou JPEG)"


def obter_candidatura_parceria_service(
    sessao: Session = Depends(obter_sessao),
    email_sender: EmailSender = Depends(obter_email_sender),
) -> CandidaturaParceriaService:
    s = obter_settings()
    # Sempre o bucket privado; sem ele não há documentos (nunca o público).
    armazenamento = R2ComprovativosStorage() if s.r2_bucket_comprovativos else None
    return CandidaturaParceriaService(
        SQLAlchemyCandidaturaParceriaRepository(sessao), email_sender, armazenamento, s.email_equipa
    )


@router.post("/documentos", response_model=DocumentoParceriaPreparado)
def preparar_documento(
    pedido: DocumentoParceriaPedido,
    servico: CandidaturaParceriaService = Depends(obter_candidatura_parceria_service),
) -> DocumentoParceriaPreparado:
    """URL de `PUT` assinado para o browser enviar um documento da empresa
    directamente ao R2 privado. Os bytes nunca passam por aqui."""
    try:
        preparado = servico.preparar_documento(pedido.content_type)
    except TipoDeDocumentoNaoPermitidoError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=_TIPO_INVALIDO) from exc
    except DocumentosIndisponiveisError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_SEM_DOCUMENTOS) from exc
    return DocumentoParceriaPreparado(url_de_upload=preparado.url_de_upload, chave=preparado.chave)


@router.post("/candidaturas", response_model=CandidaturaParceriaPublica, status_code=status.HTTP_201_CREATED)
def submeter_candidatura(
    dados: CandidaturaParceriaCriar,
    servico: CandidaturaParceriaService = Depends(obter_candidatura_parceria_service),
) -> CandidaturaParceriaPublica:
    # Uma falha de gravação não é apanhada aqui: propaga para um 500, nunca
    # um 201 fabricado (CLAUDE.md §6).
    try:
        candidatura = servico.submeter(
            DadosCandidaturaParceria(
                denominacao=dados.denominacao,
                nif=dados.nif,
                tipo=dados.tipo,
                provincia=dados.provincia,
                morada=dados.morada,
                website=dados.website,
                representante_nome=dados.representante_nome,
                representante_cargo=dados.representante_cargo,
                email=dados.email,
                telefone=dados.telefone,
                mensagem=dados.mensagem,
                documentos=tuple(
                    DocumentoParceria(chave=d.chave, nome=d.nome, content_type=d.content_type)
                    for d in dados.documentos
                ),
            )
        )
    except ChaveDeDocumentoInvalidaError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="esse documento não é um documento de parceria válido"
        ) from exc
    except TipoDeDocumentoNaoPermitidoError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=_TIPO_INVALIDO) from exc
    except DemasiadosDocumentosError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="no máximo 5 documentos"
        ) from exc
    except DocumentosIndisponiveisError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_SEM_DOCUMENTOS) from exc
    return CandidaturaParceriaPublica(referencia=candidatura.referencia)
