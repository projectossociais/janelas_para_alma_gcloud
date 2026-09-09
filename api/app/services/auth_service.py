"""Regras de negócio da autenticação. Sem HTTP aqui — nada de `Request` nem
`HTTPException`; devolve resultados ou levanta erros de domínio. O router
(`app/routers/auth.py`) é que traduz isto para respostas HTTP.

Esta é a fronteira de segurança inteira do sistema agora que não há Supabase
Auth nem RLS por baixo — testar isto bem não é opcional.
"""

from dataclasses import dataclass

from app.core.security import (
    criar_access_token,
    criar_refresh_token,
    descodificar_token,
    hash_password,
    verificar_password,
)
from app.repositories.utilizadores_repository import UtilizadoresRepository, UtilizadorRegisto


class EmailJaRegistadoError(Exception):
    pass


class CredenciaisInvalidasError(Exception):
    pass


class RefreshTokenInvalidoError(Exception):
    pass


@dataclass(frozen=True)
class ParDeTokens:
    access_token: str
    refresh_token: str


class AuthService:
    def __init__(self, repositorio: UtilizadoresRepository) -> None:
        self._repo = repositorio

    def registar(self, email: str, password: str) -> UtilizadorRegisto:
        """Regista um utilizador novo. `password` já vem validada como forte
        pelo schema Pydantic (UtilizadorCriar) antes de chegar aqui — este
        serviço não repete essa validação, mas nunca confia que o chamador
        a fez: verifica só o que é dele verificar (duplicação de email)."""
        if self._repo.obter_por_email(email) is not None:
            raise EmailJaRegistadoError(f"o email {email} já está registado")

        return self._repo.criar(email=email, password_hash=hash_password(password))

    def autenticar(self, email: str, password: str) -> ParDeTokens:
        utilizador = self._repo.obter_por_email(email)
        # Mensagem de erro idêntica para email inexistente ou password errada
        # de propósito — não confirmar a um atacante que um email existe.
        if utilizador is None or not verificar_password(password, utilizador.password_hash):
            raise CredenciaisInvalidasError("email ou password incorretos")

        return ParDeTokens(
            access_token=criar_access_token(utilizador.id),
            refresh_token=criar_refresh_token(utilizador.id),
        )

    def renovar_access_token(self, refresh_token: str) -> str:
        try:
            payload = descodificar_token(refresh_token, tipo_esperado="refresh")
        except Exception as exc:  # TokenInvalidoError, ver app/core/security.py
            raise RefreshTokenInvalidoError(str(exc)) from exc

        utilizador_id = payload["sub"]
        if self._repo.obter_por_id(utilizador_id) is None:
            raise RefreshTokenInvalidoError("utilizador já não existe")

        return criar_access_token(utilizador_id)
