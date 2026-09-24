"""Dependencies do FastAPI partilhadas por mais do que um router.

`obter_utilizador_atual` é a fronteira de autorização de qualquer rota
protegida — vive aqui, não dentro de `routers/auth.py`, precisamente porque
deixou de ser só do router de autenticação a partir do momento em que um
segundo router (perfil, e os que se seguirem) também precisa dela.
"""

from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import obter_settings
from app.core.email import ConsoleEmailSender, EmailSender, ResendEmailSender
from app.core.google_auth import GoogleIdTokenVerifier, GoogleTokenVerifier
from app.db import obter_sessao
from app.repositories.clinica_parceira_repository import (
    ClinicaParceiraRegisto,
    SQLAlchemyClinicaParceiraRepository,
)
from app.repositories.equipa_clinica_repository import SQLAlchemyEquipaClinicaRepository
from app.repositories.tokens_confirmacao_repository import SQLAlchemyTokensConfirmacaoRepository
from app.repositories.tokens_recuperacao_repository import SQLAlchemyTokensRecuperacaoRepository
from app.repositories.utilizadores_repository import (
    SQLAlchemyUtilizadoresRepository,
    UtilizadorRegisto,
)
from app.services.auth_service import AuthService, CredenciaisInvalidasError
from app.services.confirmacao_email_service import ConfirmacaoEmailService
from app.services.conta_service import ContaService
from app.services.recuperacao_password_service import RecuperacaoPasswordService


def obter_auth_service(sessao: Session = Depends(obter_sessao)) -> AuthService:
    return AuthService(SQLAlchemyUtilizadoresRepository(sessao))


def obter_conta_service(sessao: Session = Depends(obter_sessao)) -> ContaService:
    return ContaService(SQLAlchemyUtilizadoresRepository(sessao))


def obter_email_sender() -> EmailSender:
    # Sem chave (dev local sem .env preenchido), cair no envio por consola em
    # vez de tentar chamar o Resend a sério — chamada que falharia de
    # qualquer forma sem credenciais. Nunca acontece em produção: lá a chave
    # vem sempre do Secret Manager (ver infra/gcloud/03-secrets.sh).
    if not obter_settings().resend_api_key:
        return ConsoleEmailSender()
    return ResendEmailSender()


def obter_google_verifier() -> GoogleTokenVerifier:
    return GoogleIdTokenVerifier()


def obter_recuperacao_password_service(
    sessao: Session = Depends(obter_sessao),
    email_sender: EmailSender = Depends(obter_email_sender),
) -> RecuperacaoPasswordService:
    return RecuperacaoPasswordService(
        SQLAlchemyUtilizadoresRepository(sessao),
        SQLAlchemyTokensRecuperacaoRepository(sessao),
        email_sender,
    )


def obter_confirmacao_email_service(
    sessao: Session = Depends(obter_sessao),
    email_sender: EmailSender = Depends(obter_email_sender),
) -> ConfirmacaoEmailService:
    return ConfirmacaoEmailService(
        SQLAlchemyUtilizadoresRepository(sessao),
        SQLAlchemyTokensConfirmacaoRepository(sessao),
        email_sender,
    )


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


def obter_utilizador_admin(
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
) -> UtilizadorRegisto:
    """Protege rotas que só um administrador pode tocar (CRUD de banners,
    aprovação de pagamentos, decisão de candidaturas). Assenta em
    `obter_utilizador_atual` — sem sessão válida é 401 antes de chegar aqui;
    com sessão de um papel que não `admin`, 403.

    A verificação de papel vive só neste sítio, nunca repetida endpoint a
    endpoint (ver CLAUDE.md, "has_role deve ter uma única implementação")."""
    if utilizador.papel != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="requer papel de administrador",
        )
    return utilizador


def obter_clinica_parceira_repository(
    sessao: Session = Depends(obter_sessao),
) -> SQLAlchemyClinicaParceiraRepository:
    return SQLAlchemyClinicaParceiraRepository(sessao)


def obter_equipa_clinica_repository(
    sessao: Session = Depends(obter_sessao),
) -> SQLAlchemyEquipaClinicaRepository:
    return SQLAlchemyEquipaClinicaRepository(sessao)


def obter_clinica_do_utilizador(
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    equipa: SQLAlchemyEquipaClinicaRepository = Depends(obter_equipa_clinica_repository),
    clinicas: SQLAlchemyClinicaParceiraRepository = Depends(obter_clinica_parceira_repository),
) -> ClinicaParceiraRegisto:
    """Protege o portal da clínica (`routers/clinicas.py`, agendamentos da
    própria clínica). `papel: "profissional"` é auto-registável sem
    verificação nenhuma (`PAPEIS_AUTO_REGISTAVEIS`) -- por isso o acesso
    nunca vem desse papel, só de uma ligação `equipa_clinica` criada por um
    admin (`POST /admin/clinicas/{id}/equipa`). Sem sessão, 401 antes de
    chegar aqui; com sessão mas sem ligação, 403."""
    membro = equipa.obter_por_utilizador(utilizador.id)
    if membro is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="conta sem clínica associada")
    clinica = clinicas.obter(membro.clinica_id)
    if clinica is None:  # pragma: no cover -- FK garante isto, defesa a mais
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="conta sem clínica associada")
    return clinica


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
