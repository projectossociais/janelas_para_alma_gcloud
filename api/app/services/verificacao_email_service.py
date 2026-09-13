"""Regras de negócio dos dois fluxos por email de uso único: recuperação de
password e confirmação de conta no registo. Partilham a mesma tabela
(`tokens_email`) e a mesma forma (gerar um segredo, enviar por email, gastar
uma vez) — ver `docs/BACKLOG.md`, sprint "Identidade externa e email".

O token em bruto só existe em memória e no email enviado — nunca é
persistido; só o hash (`_hash_token`) vai para a base de dados, mesma lógica
de nunca guardar uma password em texto simples (CLAUDE.md secção 4).
"""

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from app.core.config import obter_settings
from app.core.security import hash_password
from app.repositories.email_sender import EmailSender
from app.repositories.tokens_email_repository import TokenEmailRegisto, TokensEmailRepository
from app.repositories.utilizadores_repository import UtilizadoresRepository


class TokenEmailInvalidoError(Exception):
    pass


class TokenEmailExpiradoError(Exception):
    pass


class TokenEmailJaUsadoError(Exception):
    pass


def _hash_token(token_bruto: str) -> str:
    # sha256 simples (não argon2): isto não é uma password de baixa entropia
    # escolhida por uma pessoa -- é um segredo aleatório de 32 bytes
    # (`secrets.token_urlsafe`), sem superfície de ataque por força bruta
    # relevante; o que importa é não guardar o valor em bruto.
    return hashlib.sha256(token_bruto.encode("utf-8")).hexdigest()


class VerificacaoEmailService:
    def __init__(
        self,
        repo_utilizadores: UtilizadoresRepository,
        repo_tokens: TokensEmailRepository,
        email_sender: EmailSender,
    ) -> None:
        self._repo_utilizadores = repo_utilizadores
        self._repo_tokens = repo_tokens
        self._email_sender = email_sender

    def solicitar_recuperacao_password(self, email: str) -> None:
        """Nunca revela ao chamador se o email existe, nem se é uma conta
        só-Google (sem password para repor) -- devolve sempre "aceite" do
        lado do router, quer o email exista quer não (mesma filosofia de
        `AuthService.autenticar`: uma resposta diferente já seria uma fuga
        de informação para quem está a tentar adivinhar contas)."""
        utilizador = self._repo_utilizadores.obter_por_email(email)
        if utilizador is None or utilizador.password_hash is None:
            return

        token_bruto = secrets.token_urlsafe(32)
        validade = timedelta(hours=obter_settings().token_recuperacao_password_horas)
        expira_em = datetime.now(UTC) + validade
        self._repo_tokens.criar(
            utilizador.id, "recuperacao_password", _hash_token(token_bruto), expira_em
        )

        link = f"{obter_settings().frontend_base_url}/atualizar-password?token={token_bruto}"
        self._email_sender.enviar(
            destinatario=email,
            assunto="Repor a password — Janelas Para a Alma",
            corpo_html=(
                f"<p>Recebemos um pedido para repor a sua password.</p>"
                f'<p><a href="{link}">Clique aqui para escolher uma nova password</a>.</p>'
                f"<p>Este link expira em {int(validade.total_seconds() // 3600)} hora(s). "
                f"Se não foi você a pedir, ignore este email.</p>"
            ),
        )

    def redefinir_password(self, token_bruto: str, nova_password: str) -> None:
        registo = self._consumir_token(token_bruto, "recuperacao_password")
        self._repo_utilizadores.atualizar_password_hash(registo.user_id, hash_password(nova_password))

    def solicitar_confirmacao_conta(self, utilizador_id: str, email: str) -> None:
        token_bruto = secrets.token_urlsafe(32)
        validade = timedelta(hours=obter_settings().token_confirmacao_conta_horas)
        expira_em = datetime.now(UTC) + validade
        self._repo_tokens.criar(utilizador_id, "confirmacao_conta", _hash_token(token_bruto), expira_em)

        link = f"{obter_settings().frontend_base_url}/confirmar-email?token={token_bruto}"
        self._email_sender.enviar(
            destinatario=email,
            assunto="Confirme a sua conta — Janelas Para a Alma",
            corpo_html=(
                f"<p>Bem-vindo(a) à Janelas Para a Alma!</p>"
                f'<p><a href="{link}">Clique aqui para confirmar a sua conta</a>.</p>'
                f"<p>Este link expira em {int(validade.total_seconds() // 3600)} horas.</p>"
            ),
        )

    def confirmar_conta(self, token_bruto: str) -> None:
        registo = self._consumir_token(token_bruto, "confirmacao_conta")
        self._repo_utilizadores.marcar_email_confirmado(registo.user_id)

    def _consumir_token(self, token_bruto: str, tipo_esperado: str) -> TokenEmailRegisto:
        registo = self._repo_tokens.obter_por_hash(_hash_token(token_bruto))
        if registo is None or registo.tipo != tipo_esperado:
            raise TokenEmailInvalidoError()
        if registo.usado_em is not None:
            raise TokenEmailJaUsadoError()
        if registo.expira_em < datetime.now(UTC):
            raise TokenEmailExpiradoError()

        self._repo_tokens.marcar_usado(registo.id, datetime.now(UTC))
        return registo
