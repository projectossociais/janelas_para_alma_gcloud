"""Aviso aos admins por notificação na app (sino do painel).

Partilhado pelos comprovativos de pagamento e pelas doações de materiais.
"""

from sqlalchemy.orm import Session

from app.repositories.admin_repository import SQLAlchemyAdminRepository
from app.repositories.notification_repository import SQLAlchemyNotificationRepository


class NotificadorAdminsNaApp:
    """Avisa todos os admins por notificação na app (sino do painel)."""

    def __init__(self, sessao: Session) -> None:
        self._admins = SQLAlchemyAdminRepository(sessao)
        self._notificacoes = SQLAlchemyNotificationRepository(sessao)

    def notificar(self, titulo: str, mensagem: str) -> None:
        ids = [a.id for a in self._admins.listar(papel="admin")]
        if ids:
            self._notificacoes.criar_em_massa(ids, titulo, mensagem)
