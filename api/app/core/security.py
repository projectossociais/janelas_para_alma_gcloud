"""Primitivas de segurança: hash de password e JWT.

Escolha deliberada: argon2, não bcrypt. Não estamos a herdar nada do Supabase
(decisão do utilizador: sem importação de dados de utilizadores), por isso não
há razão para herdar também a escolha de algoritmo — argon2 é a recomendação
actual da OWASP para hashing de passwords.
"""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from google.auth.exceptions import GoogleAuthError
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from passlib.context import CryptContext

from app.core.config import obter_settings

_pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def hash_password(password_plano: str) -> str:
    return _pwd_context.hash(password_plano)


def verificar_password(password_plano: str, password_hash: str) -> bool:
    return _pwd_context.verify(password_plano, password_hash)


class TokenInvalidoError(Exception):
    """O token está expirado, mal formado, ou tem assinatura inválida."""


def criar_token(dados: dict[str, Any], expira_em: timedelta, tipo: str) -> str:
    settings = obter_settings()
    agora = datetime.now(UTC)
    payload = {**dados, "tipo": tipo, "iat": agora, "exp": agora + expira_em}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def criar_access_token(utilizador_id: str) -> str:
    settings = obter_settings()
    return criar_token(
        {"sub": utilizador_id},
        timedelta(minutes=settings.access_token_expira_minutos),
        tipo="access",
    )


def criar_refresh_token(utilizador_id: str) -> str:
    settings = obter_settings()
    return criar_token(
        {"sub": utilizador_id},
        timedelta(days=settings.refresh_token_expira_dias),
        tipo="refresh",
    )


def descodificar_token(token: str, tipo_esperado: str) -> dict[str, Any]:
    settings = obter_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError as exc:
        raise TokenInvalidoError(str(exc)) from exc

    if payload.get("tipo") != tipo_esperado:
        raise TokenInvalidoError(f"esperava um token '{tipo_esperado}'")

    return payload


class TokenGoogleInvalidoError(Exception):
    """O ID token da Google tem assinatura inválida, expirou, ou não foi
    emitido para o nosso `google_oauth_client_id`."""


@dataclass(frozen=True)
class GoogleIdTokenInfo:
    sub: str
    email: str
    email_verified: bool
    nome: str | None


def verificar_id_token_google(id_token_bruto: str) -> GoogleIdTokenInfo:
    """Verifica o ID token que o Google Identity Services devolve ao
    frontend -- assinatura contra as chaves públicas da Google, emissor
    (`accounts.google.com`), audiência (o nosso `google_oauth_client_id`) e
    expiração. Nunca confiar no payload de um JWT descodificado sem isto: é
    exactamente o que um pedido forjado enviaria para se fazer passar por
    qualquer conta Google.

    Não testado directamente (precisa de rede para buscar as chaves
    públicas da Google) -- mesmo padrão de `repositories/storage.R2Presigner`.
    A lógica que decide o que fazer com um token já verificado
    (`AuthService.autenticar_com_google`) é que tem testes."""
    settings = obter_settings()
    try:
        claims = google_id_token.verify_oauth2_token(
            id_token_bruto, google_requests.Request(), settings.google_oauth_client_id
        )
    except (ValueError, GoogleAuthError) as exc:
        raise TokenGoogleInvalidoError(str(exc)) from exc

    email = claims.get("email")
    if not email:
        raise TokenGoogleInvalidoError("token sem email")

    return GoogleIdTokenInfo(
        sub=claims["sub"],
        email=email,
        email_verified=bool(claims.get("email_verified", False)),
        nome=claims.get("name"),
    )
