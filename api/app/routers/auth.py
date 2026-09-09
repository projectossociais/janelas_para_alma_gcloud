"""Router de autenticação — recebe o pedido HTTP, valida a entrada (Pydantic
já fez isso antes de chegar aqui), chama o service, traduz o resultado (ou o
erro de domínio) para uma resposta HTTP. Nunca fala com a base de dados
directamente.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import obter_sessao
from app.repositories.utilizadores_repository import SQLAlchemyUtilizadoresRepository
from app.schemas.auth import (
    ParDeTokens,
    RefreshTokenPedido,
    UtilizadorCriar,
    UtilizadorLogin,
    UtilizadorPublico,
)
from app.services.auth_service import (
    AuthService,
    CredenciaisInvalidasError,
    EmailJaRegistadoError,
    RefreshTokenInvalidoError,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def obter_auth_service(sessao: Session = Depends(obter_sessao)) -> AuthService:
    return AuthService(SQLAlchemyUtilizadoresRepository(sessao))


@router.post("/registar", response_model=UtilizadorPublico, status_code=status.HTTP_201_CREATED)
def registar(dados: UtilizadorCriar, service: AuthService = Depends(obter_auth_service)) -> UtilizadorPublico:
    try:
        registo = service.registar(dados.email, dados.password)
    except EmailJaRegistadoError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    return UtilizadorPublico(id=registo.id, email=registo.email, papel=registo.papel, criado_em=registo.criado_em)


@router.post("/entrar", response_model=ParDeTokens)
def entrar(dados: UtilizadorLogin, service: AuthService = Depends(obter_auth_service)) -> ParDeTokens:
    try:
        tokens = service.autenticar(dados.email, dados.password)
    except CredenciaisInvalidasError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    return ParDeTokens(access_token=tokens.access_token, refresh_token=tokens.refresh_token)


@router.post("/atualizar-token", response_model=ParDeTokens)
def atualizar_token(
    dados: RefreshTokenPedido, service: AuthService = Depends(obter_auth_service)
) -> ParDeTokens:
    try:
        novo_access_token = service.renovar_access_token(dados.refresh_token)
    except RefreshTokenInvalidoError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    return ParDeTokens(access_token=novo_access_token, refresh_token=dados.refresh_token)
