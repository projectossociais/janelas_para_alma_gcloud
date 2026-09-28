"""Processa as contas cujo prazo de eliminação (W-03) já venceu.

Corrido por um job diário (Cloud Scheduler → endpoint interno protegido,
ver `routers/interno.py`), nunca por um utilizador directamente -- não há
"o utilizador podia mentir sobre isto" aqui, é uma tarefa de manutenção sem
entrada humana. Mesmo assim tem testes: uma conta anonimizada duas vezes, ou
uma conta anonimizada sem o prazo ter vencido, seriam bugs sérios (perda de
dados sem aviso), não só um detalhe de implementação.

O email anónimo e o password hash inválido são decididos aqui, não no
repository -- é política de negócio ("o que significa esta conta estar
anonimizada"), o repository só sabe aplicar a mudança.
"""

import logging
import secrets
from datetime import UTC, datetime

from app.core.security import hash_password
from app.repositories.eliminacao_conta_repository import EliminacaoContaRepository

logger = logging.getLogger(__name__)

DOMINIO_EMAIL_ANONIMO = "anonimo.janelasparaalma.com"
NOME_ANONIMO = "Conta eliminada"


class EliminacaoContaService:
    def __init__(self, repositorio: EliminacaoContaRepository) -> None:
        self._repo = repositorio

    def processar_pendentes(self) -> int:
        agora = datetime.now(UTC)
        ids = self._repo.listar_pendentes(agora)
        for utilizador_id in ids:
            email_anonimo = f"conta-eliminada+{utilizador_id}@{DOMINIO_EMAIL_ANONIMO}"
            password_hash_invalido = hash_password(secrets.token_urlsafe(32))
            self._repo.anonimizar(
                utilizador_id,
                agora,
                email_anonimo=email_anonimo,
                password_hash_invalido=password_hash_invalido,
                nome_anonimo=NOME_ANONIMO,
            )
            logger.info("conta %s anonimizada (prazo de eliminação vencido)", utilizador_id)
        return len(ids)
