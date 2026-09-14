"""Regras de negócio da confirmação de conta por email (AUTH-02). Sem HTTP
aqui — mesmo princípio de `auth_service.py`: devolve resultados ou levanta
erros de domínio, o router traduz para HTTP.

Três operações:
- `enviar`: gera um token de uso único e manda o link por email. Chamado
  logo a seguir a um registo bem-sucedido — ao contrário da recuperação de
  password, aqui já se sabe que a conta existe (acabou de ser criada), não
  há preocupação de enumeração.
- `confirmar`: valida o token (existe, não expirou, não foi usado) e marca
  a conta como confirmada.
- `reenviar`: pedido explícito de um novo link, por email. Aqui sim nunca
  revela se a conta existe (mesmo princípio de RecuperacaoPasswordService) —
  é um endpoint público que recebe só um email.
"""

import hashlib
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from app.core.config import obter_settings
from app.core.email import EmailSender
from app.repositories.tokens_confirmacao_repository import TokensConfirmacaoRepository
from app.repositories.utilizadores_repository import UtilizadoresRepository, UtilizadorRegisto

# Mais longa que a da recuperação de password (30 min) -- confirmar a conta
# não é tão urgente como recuperar acesso perdido, e o email pode demorar a
# ser visto.
VALIDADE_TOKEN = timedelta(hours=24)


class TokenConfirmacaoInvalidoError(Exception):
    """Cobre token inexistente, já usado, ou expirado -- mesma mensagem
    para os três casos, pela mesma razão que a recuperação de password usa
    uma mensagem única: não dar pistas a quem tenta adivinhar ou reutilizar
    um token."""


@dataclass(frozen=True)
class PedidoDeReenvio:
    """Resultado de `reenviar` -- só para os testes; o router nunca expõe
    `email_enviado` na resposta, para não revelar se a conta existe."""

    email_enviado: bool


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class ConfirmacaoEmailService:
    def __init__(
        self,
        utilizadores_repo: UtilizadoresRepository,
        tokens_repo: TokensConfirmacaoRepository,
        email_sender: EmailSender,
    ) -> None:
        self._utilizadores = utilizadores_repo
        self._tokens = tokens_repo
        self._email = email_sender

    def enviar(self, utilizador: UtilizadorRegisto) -> None:
        token = secrets.token_urlsafe(32)
        expira_em = datetime.now(UTC) + VALIDADE_TOKEN
        self._tokens.criar(utilizador.id, _hash_token(token), expira_em)

        settings = obter_settings()
        link = f"{settings.frontend_base_url}/confirmar-email?token={token}"
        self._email.enviar(
            destinatario=utilizador.email,
            assunto="Confirme a sua conta — Janelas Para a Alma",
            corpo_html=(
                f"<p>Bem-vindo(a) à Janelas Para a Alma! Confirme a sua conta para poder entrar.</p>"
                f'<p><a href="{link}">Clique aqui para confirmar o seu email</a>.</p>'
                f"<p>Este link expira em 24 horas.</p>"
            ),
        )

    def confirmar(self, token: str) -> None:
        registo = self._tokens.obter_por_hash(_hash_token(token))
        agora = datetime.now(UTC)

        if registo is None or registo.usado_em is not None or registo.expira_em < agora:
            raise TokenConfirmacaoInvalidoError("este link de confirmação é inválido ou expirou")

        self._utilizadores.confirmar_email(registo.utilizador_id)
        self._tokens.marcar_usado(registo.id, agora)

    def reenviar(self, email: str) -> PedidoDeReenvio:
        utilizador = self._utilizadores.obter_por_email(email)
        # Sem conta com este email, ou já confirmada: comportamento idêntico
        # ao caso de sucesso aos olhos de quem chamou, só sem token nem
        # email a sair.
        if utilizador is None or utilizador.email_confirmado:
            return PedidoDeReenvio(email_enviado=False)

        self.enviar(utilizador)
        return PedidoDeReenvio(email_enviado=True)
