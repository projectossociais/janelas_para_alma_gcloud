"""Fixtures partilhadas por toda a suite de testes da API.

`_sem_envio_de_email_por_omissao` existe porque `POST /auth/registar` passou
a disparar (best-effort) o envio do email de confirmação de conta — ver
`routers/auth.py`. Sem isto, qualquer teste de router que já chamava
`/auth/registar` antes desta peça existir (há vários, em ficheiros
diferentes) tentaria mesmo construir um `SQLAlchemyTokensEmailRepository`
real com o id fabricado pelo repositório falso de autenticação de cada
teste -- nunca chega a enviar nada (o router apanha a excepção), mas gera
ruído e um pedido de I/O desperdiçado em todos esses testes.

Testes que querem examinar o comportamento do envio em si
(`test_auth_router.py`) substituem este `dependency_override` pelo seu
próprio, mais específico -- `app.dependency_overrides` é só um dicionário,
o último a escrever para a mesma chave é o que vale.
"""

import pytest

from app.main import app
from app.routers.auth import obter_verificacao_email_service


class VerificacaoEmailServiceNulo:
    """Aceita qualquer chamada, não faz nada. Fake nulo de propósito -- os
    testes que precisam de verificar o conteúdo do email substituem isto."""

    def solicitar_confirmacao_conta(self, utilizador_id: str, email: str) -> None:
        pass

    def solicitar_recuperacao_password(self, email: str) -> None:
        pass

    def redefinir_password(self, token: str, password_nova: str) -> None:
        pass

    def confirmar_conta(self, token: str) -> None:
        pass


@pytest.fixture(autouse=True)
def _sem_envio_de_email_por_omissao():
    app.dependency_overrides[obter_verificacao_email_service] = VerificacaoEmailServiceNulo
    yield
    app.dependency_overrides.pop(obter_verificacao_email_service, None)
