"""Dependencies do FastAPI partilhadas por mais do que um router.

`obter_utilizador_atual` é a fronteira de autorização de qualquer rota
protegida — vive aqui, não dentro de `routers/auth.py`, precisamente porque
deixou de ser só do router de autenticação a partir do momento em que um
segundo router (perfil, e os que se seguirem) também precisa dela.
"""

from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import obter_sessao
from app.repositories.utilizadores_repository import (
    SQLAlchemyUtilizadoresRepository,
    UtilizadorRegisto,
)
from app.services.auth_service import AuthService, CredenciaisInvalidasError
from app.services.conta_service import ContaService


def obter_auth_service(sessao: Session = Depends(obter_sessao)) -> AuthService:
    return AuthService(SQLAlchemyUtilizadoresRepository(sessao))


def obter_conta_service(sessao: Session = Depends(obter_sessao)) -> ContaService:
    return ContaService(SQLAlchemyUtilizadoresRepository(sessao))


def obter_utilizador_atual(
    access_token: str | None = Cookie(default=None),
    service: AuthService = Depends(obter_auth_service),
) -> UtilizadorRegisto:
    """Dependency que protege qualquer rota autenticada — basta declarar
    `Depends(obter_utilizador_atual)`. Sem cookie válido, 401 antes de a
    rota sequer correr."""
    if access_token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="sem sessão")

    try:
        return service.utilizador_a_partir_do_access_token(access_token)
    except CredenciaisInvalidasError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc


def obter_utilizador_atual_opcional(
    access_token: str | None = Cookie(default=None),
    service: AuthService = Depends(obter_auth_service),
) -> UtilizadorRegisto | None:
    """Para rotas públicas que identificam o utilizador quando ele tem
    sessão, sem exigir uma (ex.: feedback anónimo). Nunca 401 -- um cookie
    ausente ou inválido só significa "sem identidade conhecida", não erro."""
    if access_token is None:
        return None
    try:
        return service.utilizador_a_partir_do_access_token(access_token)
    except CredenciaisInvalidasError:
        return None
