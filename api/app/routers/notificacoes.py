"""Notificações (ADMIN-04) — substitui o antigo `AdminNotifications.tsx`,
que escrevia num "notifications" do Supabase sem nenhum consumidor real do
lado do site. Aqui um envio de admin cria mesmo uma linha por utilizador-
-alvo, e qualquer sessão autenticada lê só as suas."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import obter_utilizador_admin, obter_utilizador_atual
from app.db import obter_sessao
from app.repositories.admin_repository import SQLAlchemyAdminRepository
from app.repositories.notification_repository import SQLAlchemyNotificationRepository
from app.repositories.utilizadores_repository import UtilizadorRegisto
from app.schemas.notifications import (
    ContagemNaoLidas,
    NotificacaoEnviada,
    NotificacaoEnviar,
    NotificacaoPublica,
)
from app.services.notification_service import (
    NotificacaoNaoEncontradaError,
    NotificationService,
    PapelDeNotificacaoInvalidoError,
)

router = APIRouter(prefix="/notificacoes", tags=["notificacoes"])


def obter_notification_service(sessao: Session = Depends(obter_sessao)) -> NotificationService:
    return NotificationService(
        SQLAlchemyNotificationRepository(sessao), SQLAlchemyAdminRepository(sessao)
    )


# --- Qualquer sessão autenticada -- só vê as suas próprias --------------------


@router.get("", response_model=list[NotificacaoPublica])
def listar_minhas(
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    servico: NotificationService = Depends(obter_notification_service),
) -> list[NotificacaoPublica]:
    return servico.listar_minhas(utilizador.id)


@router.get("/nao-lidas/contagem", response_model=ContagemNaoLidas)
def contar_nao_lidas(
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    servico: NotificationService = Depends(obter_notification_service),
) -> ContagemNaoLidas:
    return ContagemNaoLidas(contagem=servico.contar_nao_lidas(utilizador.id))


@router.post("/{notificacao_id}/marcar-lida", response_model=NotificacaoPublica)
def marcar_lida(
    notificacao_id: str,
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    servico: NotificationService = Depends(obter_notification_service),
) -> NotificacaoPublica:
    try:
        return servico.marcar_lida(notificacao_id, utilizador.id)
    except NotificacaoNaoEncontradaError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="notificação não encontrada"
        ) from exc


@router.post("/marcar-todas-lidas", status_code=status.HTTP_204_NO_CONTENT)
def marcar_todas_lidas(
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    servico: NotificationService = Depends(obter_notification_service),
) -> None:
    servico.marcar_todas_lidas(utilizador.id)


# --- Administração -----------------------------------------------------------


@router.post(
    "/admin/enviar",
    response_model=NotificacaoEnviada,
    dependencies=[Depends(obter_utilizador_admin)],
)
def enviar(
    dados: NotificacaoEnviar,
    servico: NotificationService = Depends(obter_notification_service),
) -> NotificacaoEnviada:
    try:
        enviadas = servico.enviar(dados.titulo, dados.mensagem, dados.papel)
    except PapelDeNotificacaoInvalidoError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"papel '{dados.papel}' inválido"
        ) from exc
    return NotificacaoEnviada(enviadas=enviadas)
