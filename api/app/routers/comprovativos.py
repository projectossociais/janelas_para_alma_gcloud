"""Leitura de comprovativos de pagamento pelo painel de administração.

Só admin. Devolve um URL assinado de vida curta para o comprovativo no
bucket privado — nunca um URL permanente (ver
`services/comprovativo_leitura_service.py`)."""

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.config import obter_settings
from app.core.dependencies import obter_utilizador_admin
from app.db import obter_sessao
from app.repositories.comprovativos_repository import (
    OrigemComprovativo,
    SQLAlchemyComprovativosRepository,
)
from app.repositories.storage import R2ComprovativosStorage
from app.schemas.upload import ComprovativoParaLer
from app.services.comprovativo_leitura_service import (
    ArmazenamentoPrivadoIndisponivelError,
    ComprovativoLeituraService,
    ComprovativoNaoEncontradoError,
)

router = APIRouter(prefix="/admin/comprovativos", tags=["admin"])


def obter_comprovativo_leitura_service(
    sessao: Session = Depends(obter_sessao),
) -> ComprovativoLeituraService:
    return ComprovativoLeituraService(
        SQLAlchemyComprovativosRepository(sessao),
        R2ComprovativosStorage.se_configurado(),
        obter_settings().r2_comprovativo_url_expira_segundos,
    )


@router.get(
    "/{origem}/{registo_id}",
    response_model=ComprovativoParaLer,
    dependencies=[Depends(obter_utilizador_admin)],
)
def abrir_comprovativo(
    origem: OrigemComprovativo,
    registo_id: str,
    response: Response,
    servico: ComprovativoLeituraService = Depends(obter_comprovativo_leitura_service),
) -> ComprovativoParaLer:
    """`origem`: `premium` (pedido Premium), `doacao` (doação financeira) ou
    `loja` (pedido da loja do jogo pago em Kwanzas)."""
    try:
        comprovativo = servico.url_para_admin(origem, registo_id)
    except ComprovativoNaoEncontradoError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="comprovativo não encontrado"
        ) from exc
    except ArmazenamentoPrivadoIndisponivelError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="armazenamento dos comprovativos por configurar",
        ) from exc
    # Um URL assinado não deve ficar em nenhuma cache pelo caminho.
    response.headers["Cache-Control"] = "no-store"
    return ComprovativoParaLer(url=comprovativo.url, expira_em_segundos=comprovativo.expira_em_segundos)
