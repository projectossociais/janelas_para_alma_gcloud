"""Regras de negócio de "esqueci-me da password". Sem HTTP aqui — mesmo
princípio de `auth_service.py`: devolve resultados ou levanta erros de
domínio, o router é que traduz para respostas HTTP.

Duas operações:
- `solicitar`: gera um token de uso único e manda o link por email. Nunca
  revela se o email existe ou não — a resposta ao chamador é sempre a
  mesma, exista ou não conta com aquele email (evita enumeração de contas).
- `redefinir`: valida o token (existe, não expirou, não foi usado) e troca
  a password.
"""

import hashlib
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from app.core.config import obter_settings
from app.core.email import EmailSender
from app.core.security import hash_password
from app.repositories.tokens_recuperacao_repository import TokensRecuperacaoRepository
from app.repositories.utilizadores_repository import UtilizadoresRepository

# Curta de propósito: um link de recuperação vivo demasiado tempo é uma
# janela de ataque maior (email pode ser lido por terceiros, ficar numa
# caixa partilhada, etc.).
VALIDADE_TOKEN = timedelta(minutes=30)


class TokenRecuperacaoInvalidoError(Exception):
    """Cobre token inexistente, já usado, ou expirado — a mesma mensagem
    para os três casos, pela mesma razão que login usa uma mensagem única
    para email/password errados: não dar pistas a quem está a tentar
    adivinhar ou reutilizar um token."""


@dataclass(frozen=True)
class SolicitacaoRecuperacao:
    """Resultado da solicitação — nunca inclui o token em claro (esse só
    existe no email enviado). `email_enviado` serve só para os testes; o
    router nunca o expõe na resposta, para não revelar se a conta existe."""

    email_enviado: bool


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class RecuperacaoPasswordService:
    def __init__(
        self,
        utilizadores_repo: UtilizadoresRepository,
        tokens_repo: TokensRecuperacaoRepository,
        email_sender: EmailSender,
    ) -> None:
        self._utilizadores = utilizadores_repo
        self._tokens = tokens_repo
        self._email = email_sender

    def solicitar(self, email: str) -> SolicitacaoRecuperacao:
        utilizador = self._utilizadores.obter_por_email(email)
        if utilizador is None:
            # Sem conta com este email: comportamento idêntico ao caso de
            # sucesso aos olhos de quem chamou, só sem token nem email.
            return SolicitacaoRecuperacao(email_enviado=False)

        token = secrets.token_urlsafe(32)
        expira_em = datetime.now(UTC) + VALIDADE_TOKEN
        self._tokens.criar(utilizador.id, _hash_token(token), expira_em)

        settings = obter_settings()
        link = f"{settings.frontend_base_url}/atualizar-password?token={token}"
        self._email.enviar(
            destinatario=utilizador.email,
            assunto="Recuperar a sua palavra-passe — Janelas Para a Alma",
            corpo_html=(
                f"<p>Recebemos um pedido para redefinir a sua palavra-passe.</p>"
                f'<p><a href="{link}">Clique aqui para definir uma nova palavra-passe</a>.</p>'
                f"<p>Este link expira em 30 minutos. Se não foi você a pedir, ignore este email — "
                f"a sua palavra-passe actual continua válida.</p>"
            ),
        )
        return SolicitacaoRecuperacao(email_enviado=True)

    def redefinir(self, token: str, nova_password: str) -> None:
        registo = self._tokens.obter_por_hash(_hash_token(token))
        agora = datetime.now(UTC)

        if registo is None or registo.usado_em is not None or registo.expira_em < agora:
            raise TokenRecuperacaoInvalidoError("este link de recuperação é inválido ou expirou")

        self._utilizadores.atualizar_password_hash(registo.utilizador_id, hash_password(nova_password))
        self._tokens.marcar_usado(registo.id, agora)
