"""Verificação de tokens de identidade do Google (Sign In With Google).

Mesmo padrão do `EmailSender` em `core/email.py`: um Protocol de que o
`AuthService` depende, não a implementação concreta — é o que torna
`entrar_com_google` testável sem rede nem chave real.

Nunca confiar num email vindo do browser sem esta verificação: um pedido
forjado a `POST /auth/google` podia enviar qualquer `id_token` (ou nenhum) a
alegar ser qualquer conta — a única coisa que impede isso é verificar a
assinatura contra as chaves públicas do Google e confirmar que o token foi
emitido mesmo para esta aplicação (`audience` == `google_client_id`).
"""

from dataclasses import dataclass
from typing import Protocol

from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

from app.core.config import obter_settings


class TokenGoogleInvalidoError(Exception):
    """Assinatura inválida, token expirado, ou emitido para outra
    aplicação (`audience` errada)."""


@dataclass(frozen=True)
class PerfilGoogle:
    email: str
    email_verificado: bool
    nome: str | None


class GoogleTokenVerifier(Protocol):
    def verificar(self, id_token_str: str) -> PerfilGoogle: ...


class GoogleIdTokenVerifier:
    """Implementação real. A biblioteca `google-auth` trata da cache e
    rotação das chaves públicas do Google — nunca geridas à mão aqui."""

    def verificar(self, id_token_str: str) -> PerfilGoogle:
        settings = obter_settings()
        try:
            payload = google_id_token.verify_oauth2_token(
                id_token_str, google_requests.Request(), settings.google_client_id
            )
        except ValueError as exc:
            raise TokenGoogleInvalidoError(str(exc)) from exc

        return PerfilGoogle(
            email=payload["email"],
            email_verificado=bool(payload.get("email_verified", False)),
            nome=payload.get("name"),
        )
