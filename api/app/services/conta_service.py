"""Regras de negócio de gestão da própria conta: mudar password, agendar (e
cancelar) a eliminação. Fronteira de segurança tal como o auth_service — só
aqui, não faz mal repetir: mudar a password de outra pessoa, ou apagar uma
conta que não é a nossa, tem de ser estruturalmente impossível, não apenas
não-testado.
"""

from datetime import UTC, datetime, timedelta

from app.core.security import hash_password, verificar_password
from app.repositories.utilizadores_repository import UtilizadoresRepository

DIAS_DE_CARENCIA_ELIMINACAO = 30


class PasswordAtualIncorretaError(Exception):
    pass


class ContaService:
    def __init__(self, repositorio: UtilizadoresRepository) -> None:
        self._repo = repositorio

    def mudar_password(self, utilizador_id: str, password_atual: str, password_nova: str) -> None:
        utilizador = self._repo.obter_por_id(utilizador_id)
        if utilizador is None or not verificar_password(password_atual, utilizador.password_hash):
            raise PasswordAtualIncorretaError("password atual incorreta")

        self._repo.atualizar_password_hash(utilizador_id, hash_password(password_nova))

    def agendar_eliminacao(self, utilizador_id: str) -> datetime:
        """Nunca apaga na hora — agenda para daqui a 30 dias. Voltar a
        entrar dentro desse prazo cancela o pedido (ver routers/auth.py)."""
        quando = datetime.now(UTC) + timedelta(days=DIAS_DE_CARENCIA_ELIMINACAO)
        self._repo.agendar_eliminacao(utilizador_id, quando)
        return quando

    def cancelar_eliminacao_se_agendada(self, utilizador_id: str) -> bool:
        return self._repo.cancelar_eliminacao_se_agendada(utilizador_id)
