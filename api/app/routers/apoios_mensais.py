"""Apoio mensal (Kamba Mensal). Exige sessão: o apoio fica ligado à conta, e
o dono é sempre o utilizador do JWT -- nunca um id vindo do pedido. As regras
vivem no `ApoioMensalService`.
"""

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.dependencies import obter_email_sender, obter_utilizador_atual
from app.core.email import EmailSender
from app.db import obter_sessao
from app.repositories.apoios_mensais_repository import SQLAlchemyApoiosMensaisRepository
from app.repositories.utilizadores_repository import UtilizadorRegisto
from app.schemas.apoio_mensal import ApoioMensalCriar, ApoioMensalPublico, ComprovativoApoioMensal
from app.services.apoio_mensal_service import (
    ApoioMensalJaExisteError,
    ApoioMensalNaoEncontradoError,
    ApoioMensalService,
    EstadoApoioMensal,
    ValorMensalInvalidoError,
)
from app.services.comprovativo_upload_service import ChaveDeComprovativoInvalidaError

router = APIRouter(prefix="/apoios-mensais", tags=["apoios-mensais"])


def obter_apoio_mensal_service(
    sessao: Session = Depends(obter_sessao),
    email_sender: EmailSender = Depends(obter_email_sender),
) -> ApoioMensalService:
    return ApoioMensalService(SQLAlchemyApoiosMensaisRepository(sessao), email_sender)


@router.get("/meu", response_model=ApoioMensalPublico | None)
def obter_o_meu(
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    servico: ApoioMensalService = Depends(obter_apoio_mensal_service),
) -> EstadoApoioMensal | None:
    return servico.obter(utilizador.id)


@router.post("", response_model=ApoioMensalPublico, status_code=status.HTTP_201_CREATED)
def aderir(
    dados: ApoioMensalCriar,
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    servico: ApoioMensalService = Depends(obter_apoio_mensal_service),
) -> EstadoApoioMensal:
    try:
        return servico.aderir(utilizador.id, dados.valor_mensal_kz)
    except ValorMensalInvalidoError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)) from exc
    except ApoioMensalJaExisteError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.post("/meu/comprovativos", response_model=ApoioMensalPublico, status_code=status.HTTP_201_CREATED)
def enviar_comprovativo(
    dados: ComprovativoApoioMensal,
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    servico: ApoioMensalService = Depends(obter_apoio_mensal_service),
) -> EstadoApoioMensal:
    # Uma falha a gravar ou a enviar a confirmação não é apanhada aqui:
    # propaga para um 500, nunca um 201 fabricado (ver DoacaoService).
    try:
        return servico.registar_comprovativo(utilizador.id, utilizador.email, dados.comprovativo_chave)
    except ApoioMensalNaoEncontradoError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ChaveDeComprovativoInvalidaError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="essa chave não é um comprovativo válido"
        ) from exc


@router.delete("/meu", status_code=status.HTTP_204_NO_CONTENT)
def cancelar(
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    servico: ApoioMensalService = Depends(obter_apoio_mensal_service),
) -> Response:
    try:
        servico.cancelar(utilizador.id)
    except ApoioMensalNaoEncontradoError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
