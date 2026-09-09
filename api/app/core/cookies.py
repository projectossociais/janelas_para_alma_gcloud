"""Cookies de sessão — partilhado entre `routers/auth.py` e `routers/conta.py`
(eliminar a conta também limpa a sessão). Ver app/schemas/auth.py para o
porquê de a sessão nunca viajar no corpo JSON.
"""

from fastapi import Response

from app.core.config import obter_settings
from app.services.auth_service import ParDeTokens

COOKIE_ACCESS = "access_token"
COOKIE_REFRESH = "refresh_token"


def definir_cookie_acesso(response: Response, access_token: str) -> None:
    settings = obter_settings()
    response.set_cookie(
        COOKIE_ACCESS,
        access_token,
        max_age=settings.access_token_expira_minutos * 60,
        httponly=True,
        secure=settings.cookie_seguro,
        samesite="lax",
        path="/",
    )


def definir_cookies_sessao(response: Response, tokens: ParDeTokens) -> None:
    settings = obter_settings()
    definir_cookie_acesso(response, tokens.access_token)
    response.set_cookie(
        COOKIE_REFRESH,
        tokens.refresh_token,
        max_age=settings.refresh_token_expira_dias * 86400,
        httponly=True,
        secure=settings.cookie_seguro,
        samesite="lax",
        path="/",
    )


def limpar_cookies_sessao(response: Response) -> None:
    response.delete_cookie(COOKIE_ACCESS, path="/")
    response.delete_cookie(COOKIE_REFRESH, path="/")
