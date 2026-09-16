"""Acesso a dados das notificações (ADMIN-04) — tabela `notifications`, que
já existia no esquema (baseline) mas nunca teve nenhum consumidor real: o
antigo `AdminNotifications.tsx` escrevia directamente numa tabela homónima
do Supabase, sem nenhuma ligação a esta. Um broadcast por papel cria uma
linha por utilizador-alvo (mesmo desenho denormalizado que já existia:
`user_id` por linha, sem uma tabela "envio" à parte)."""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.repositories.orm_models import Notification


@dataclass(frozen=True)
class NotificacaoRegisto:
    id: str
    user_id: str
    titulo: str
    mensagem: str
    lida: bool
    created_at: datetime


class NotificationRepository(Protocol):
    def criar_em_massa(self, utilizador_ids: list[str], titulo: str, mensagem: str) -> int: ...
    def listar_do_utilizador(self, utilizador_id: str, limite: int = 50) -> list[NotificacaoRegisto]: ...
    def contar_nao_lidas(self, utilizador_id: str) -> int: ...
    def obter_por_id(self, notificacao_id: str) -> NotificacaoRegisto | None: ...
    def marcar_lida(self, notificacao_id: str) -> NotificacaoRegisto | None: ...
    def marcar_todas_lidas(self, utilizador_id: str) -> None: ...


class SQLAlchemyNotificationRepository:
    def __init__(self, sessao: Session) -> None:
        self._sessao = sessao

    def _para_registo(self, row: Notification) -> NotificacaoRegisto:
        return NotificacaoRegisto(
            id=str(row.id),
            user_id=str(row.user_id),
            titulo=row.titulo,
            mensagem=row.mensagem,
            lida=bool(row.lida),
            created_at=row.created_at,
        )

    def criar_em_massa(self, utilizador_ids: list[str], titulo: str, mensagem: str) -> int:
        linhas = [
            Notification(user_id=uuid.UUID(uid), titulo=titulo, mensagem=mensagem, lida=False)
            for uid in utilizador_ids
        ]
        self._sessao.add_all(linhas)
        self._sessao.commit()
        return len(linhas)

    def listar_do_utilizador(self, utilizador_id: str, limite: int = 50) -> list[NotificacaoRegisto]:
        linhas = self._sessao.scalars(
            select(Notification)
            .where(Notification.user_id == uuid.UUID(utilizador_id))
            .order_by(Notification.created_at.desc())
            .limit(limite)
        ).all()
        return [self._para_registo(linha) for linha in linhas]

    def contar_nao_lidas(self, utilizador_id: str) -> int:
        return (
            self._sessao.scalar(
                select(func.count())
                .select_from(Notification)
                .where(
                    Notification.user_id == uuid.UUID(utilizador_id),
                    Notification.lida.is_(False),
                )
            )
            or 0
        )

    def obter_por_id(self, notificacao_id: str) -> NotificacaoRegisto | None:
        row = self._sessao.get(Notification, uuid.UUID(notificacao_id))
        return self._para_registo(row) if row else None

    def marcar_lida(self, notificacao_id: str) -> NotificacaoRegisto | None:
        row = self._sessao.get(Notification, uuid.UUID(notificacao_id))
        if row is None:
            return None
        row.lida = True
        self._sessao.commit()
        self._sessao.refresh(row)
        return self._para_registo(row)

    def marcar_todas_lidas(self, utilizador_id: str) -> None:
        linhas = self._sessao.scalars(
            select(Notification).where(
                Notification.user_id == uuid.UUID(utilizador_id),
                Notification.lida.is_(False),
            )
        ).all()
        for linha in linhas:
            linha.lida = True
        self._sessao.commit()
