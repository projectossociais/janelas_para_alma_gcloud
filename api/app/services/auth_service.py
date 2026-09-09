"""Regras de negócio da autenticação. Sem HTTP aqui — nada de `Request` nem
`HTTPException`; devolve resultados ou levanta erros de domínio. O router
(`app/routers/auth.py`) é que traduz isto para respostas HTTP.

Esta é a fronteira de segurança inteira do sistema agora que não há Supabase
Auth nem RLS por baixo — testar isto bem não é opcional.
"""

from dataclasses import dataclass

from app.core.security import (
    TokenInvalidoError,
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
    """Cobre email/password errados, e — reaproveitada de propósito — um
    cookie de sessão ausente, expirado ou inválido: para quem chama a API é
    a mesma coisa, "não estás autenticado", e mapeia sempre para 401."""


class RefreshTokenInvalidoError(Exception):
    pass


@dataclass(frozen=True)
class ParDeTokens:
    access_token: str
    refresh_token: str


@dataclass(frozen=True)
class SessaoIniciada:
    utilizador: UtilizadorRegisto
    tokens: ParDeTokens


class AuthService:
    def __init__(self, repositorio: UtilizadoresRepository) -> None:
        self._repo = repositorio

    def _emitir_tokens(self, utilizador_id: str) -> ParDeTokens:
        return ParDeTokens(
            access_token=criar_access_token(utilizador_id),
            refresh_token=criar_refresh_token(utilizador_id),
        )

    def registar(
        self,
        email: str,
        password: str,
        papel: str = "comum",
        nome: str | None = None,
        provincia: str | None = None,
        genero: str | None = None,
    ) -> SessaoIniciada:
        """Regista um utilizador novo e já devolve uma sessão iniciada — tal
        como qualquer app espera hoje, registar é entrar. `password` e
        `papel` já vêm validados pelo schema Pydantic (UtilizadorCriar) antes
        de chegar aqui — a password por ser forte, o papel por estar entre os
        auto-registáveis; este serviço verifica só o que é dele (duplicado)."""
        if self._repo.obter_por_email(email) is not None:
            raise EmailJaRegistadoError(f"o email {email} já está registado")

        utilizador = self._repo.criar(
            email=email,
            password_hash=hash_password(password),
            papel=papel,
            nome=nome,
            provincia=provincia,
            genero=genero,
        )
        return SessaoIniciada(utilizador=utilizador, tokens=self._emitir_tokens(utilizador.id))

    def autenticar(self, email: str, password: str) -> SessaoIniciada:
        utilizador = self._repo.obter_por_email(email)
        # Mensagem de erro idêntica para email inexistente ou password errada
        # de propósito — não confirmar a um atacante que um email existe.
        if utilizador is None or not verificar_password(password, utilizador.password_hash):
            raise CredenciaisInvalidasError("email ou password incorretos")

        return SessaoIniciada(utilizador=utilizador, tokens=self._emitir_tokens(utilizador.id))

    def renovar_access_token(self, refresh_token: str) -> str:
        try:
            payload = descodificar_token(refresh_token, tipo_esperado="refresh")
        except TokenInvalidoError as exc:
            raise RefreshTokenInvalidoError(str(exc)) from exc

        utilizador_id = payload["sub"]
        if self._repo.obter_por_id(utilizador_id) is None:
            raise RefreshTokenInvalidoError("utilizador já não existe")

        return criar_access_token(utilizador_id)

    def utilizador_a_partir_do_access_token(self, access_token: str) -> UtilizadorRegisto:
        """Usado pela dependency que protege rotas (ver routers/auth.py) —
        traduz o cookie de sessão num utilizador, ou levanta o mesmo erro
        de "não autenticado" que um login falhado, para o router mapear
        sempre para 401 da mesma forma."""
        try:
            payload = descodificar_token(access_token, tipo_esperado="access")
        except TokenInvalidoError as exc:
            raise CredenciaisInvalidasError(str(exc)) from exc

        utilizador = self._repo.obter_por_id(payload["sub"])
        if utilizador is None:
            raise CredenciaisInvalidasError("utilizador já não existe")

        return utilizador
