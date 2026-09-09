"""Router de autenticação — recebe o pedido HTTP, valida a entrada (Pydantic
já fez isso antes de chegar aqui), chama o service, traduz o resultado (ou o
erro de domínio) para uma resposta HTTP. Nunca fala com a base de dados
directamente.

A sessão viaja em dois cookies `httpOnly` (`access_token`, `refresh_token`),
nunca no corpo JSON — ver nota em app/schemas/auth.py.
"""

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.config import obter_settings
from app.db import obter_sessao
from app.repositories.utilizadores_repository import (
    SQLAlchemyUtilizadoresRepository,
    UtilizadorRegisto,
)
from app.schemas.auth import UtilizadorCriar, UtilizadorLogin, UtilizadorPublico
from app.services.auth_service import (
    AuthService,
    CredenciaisInvalidasError,
    EmailJaRegistadoError,
    ParDeTokens,
    RefreshTokenInvalidoError,
)

router = APIRouter(prefix="/auth", tags=["auth"])

COOKIE_ACCESS = "access_token"
COOKIE_REFRESH = "refresh_token"


def obter_auth_service(sessao: Session = Depends(obter_sessao)) -> AuthService:
    return AuthService(SQLAlchemyUtilizadoresRepository(sessao))


def _definir_cookie_acesso(response: Response, access_token: str) -> None:
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


def _definir_cookies_sessao(response: Response, tokens: ParDeTokens) -> None:
    settings = obter_settings()
    _definir_cookie_acesso(response, tokens.access_token)
    response.set_cookie(
        COOKIE_REFRESH,
        tokens.refresh_token,
        max_age=settings.refresh_token_expira_dias * 86400,
        httponly=True,
        secure=settings.cookie_seguro,
        samesite="lax",
        path="/",
    )


def _limpar_cookies_sessao(response: Response) -> None:
    response.delete_cookie(COOKIE_ACCESS, path="/")
    response.delete_cookie(COOKIE_REFRESH, path="/")


def _utilizador_publico(utilizador: UtilizadorRegisto) -> UtilizadorPublico:
    return UtilizadorPublico(
        id=utilizador.id,
        email=utilizador.email,
        papel=utilizador.papel,
        nome=utilizador.nome,
        provincia=utilizador.provincia,
        genero=utilizador.genero,
        criado_em=utilizador.criado_em,
    )


def obter_utilizador_atual(
    access_token: str | None = Cookie(default=None),
    service: AuthService = Depends(obter_auth_service),
) -> UtilizadorRegisto:
    """Dependency que protege qualquer rota autenticada — noutros routers,
    basta declarar `Depends(obter_utilizador_atual)`. Sem cookie válido,
    401 antes de a rota sequer correr."""
    if access_token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="sem sessão")

    try:
        return service.utilizador_a_partir_do_access_token(access_token)
    except CredenciaisInvalidasError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc


@router.post("/registar", response_model=UtilizadorPublico, status_code=status.HTTP_201_CREATED)
def registar(
    dados: UtilizadorCriar, response: Response, service: AuthService = Depends(obter_auth_service)
) -> UtilizadorPublico:
    try:
        sessao = service.registar(
            dados.email,
            dados.password,
            papel=dados.papel,
            nome=dados.nome,
            provincia=dados.provincia,
            genero=dados.genero,
        )
    except EmailJaRegistadoError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    _definir_cookies_sessao(response, sessao.tokens)
    return _utilizador_publico(sessao.utilizador)


@router.post("/entrar", response_model=UtilizadorPublico)
def entrar(
    dados: UtilizadorLogin, response: Response, service: AuthService = Depends(obter_auth_service)
) -> UtilizadorPublico:
    try:
        sessao = service.autenticar(dados.email, dados.password)
    except CredenciaisInvalidasError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    _definir_cookies_sessao(response, sessao.tokens)
    return _utilizador_publico(sessao.utilizador)


@router.get("/eu", response_model=UtilizadorPublico)
def eu(utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual)) -> UtilizadorPublico:
    return _utilizador_publico(utilizador)


@router.post("/sair", status_code=status.HTTP_204_NO_CONTENT)
def sair(response: Response) -> None:
    # Sem verificar sessão de propósito — sair nunca deve poder falhar por
    # já não haver sessão válida; o objectivo (cookies limpos) é sempre
    # alcançado.
    _limpar_cookies_sessao(response)


@router.post("/atualizar-token", status_code=status.HTTP_204_NO_CONTENT)
def atualizar_token(
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    service: AuthService = Depends(obter_auth_service),
) -> None:
    if refresh_token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="sem sessão")

    try:
        novo_access_token = service.renovar_access_token(refresh_token)
    except RefreshTokenInvalidoError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    _definir_cookie_acesso(response, novo_access_token)
