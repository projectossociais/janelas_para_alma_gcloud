"""Primitivas de segurança: hash de password e JWT.

Escolha deliberada: argon2, não bcrypt. Não estamos a herdar nada do Supabase
(decisão do utilizador: sem importação de dados de utilizadores), por isso não
há razão para herdar também a escolha de algoritmo — argon2 é a recomendação
actual da OWASP para hashing de passwords.
"""

from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
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
