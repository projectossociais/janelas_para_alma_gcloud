"""Regras de negócio da autenticação. Sem HTTP aqui — nada de `Request` nem
`HTTPException`; devolve resultados ou levanta erros de domínio. O router
(`app/routers/auth.py`) é que traduz isto para respostas HTTP.

Esta é a fronteira de segurança inteira do sistema agora que não há Supabase
Auth nem RLS por baixo — testar isto bem não é opcional.
"""

import secrets
from dataclasses import dataclass

from app.core.google_auth import PerfilGoogle
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


class EmailNaoConfirmadoError(Exception):
    """AUTH-02 — bloqueio total: sem confirmar o email, não há sessão
    nenhuma, mesmo com a password certa. Erro à parte de
    `CredenciaisInvalidasError` porque a mensagem é diferente (aqui sim vale
    a pena dizer o que falta — a password está certa, não há razão para
    fingir que não sabemos disso como no caso de email/password errados)."""


class EmailGoogleNaoVerificadoError(Exception):
    """O próprio Google não confirma a posse deste email (`email_verified`
    falso no token) — recusar, nunca assumir que está tudo bem."""


def _gerar_password_aleatoria() -> str:
    # Contas criadas via Google não têm password escolhida pela pessoa, mas
    # `utilizadores.password_hash` não é anulável (ver orm_models.py) -- em
    # vez de mudar o esquema, gera-se uma password aleatória, nunca
    # comunicada a ninguém, e faz-se o hash normal dela. Quem quiser entrar
    # também por password no futuro usa "esqueci-me da password" -- já
    # funciona sem alterações, porque é o mesmo fluxo de sempre.
    return secrets.token_urlsafe(32)


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
        nome_completo: str | None = None,
        provincia: str | None = None,
        genero: str | None = None,
    ) -> SessaoIniciada:
        """Regista um utilizador novo. A conta nasce por confirmar
        (AUTH-02) — devolve na mesma um `ParDeTokens` (por uniformidade com
        `autenticar`), mas é o router que decide não os pôr em cookies: sem
        confirmar o email não há sessão nenhuma, mesmo logo a seguir ao
        registo. `password` e `papel` já vêm validados pelo schema Pydantic
        (UtilizadorCriar) antes de chegar aqui — a password por ser forte, o
        papel por estar entre os auto-registáveis; este serviço verifica só
        o que é dele (duplicado)."""
        if self._repo.obter_por_email(email) is not None:
            raise EmailJaRegistadoError(f"o email {email} já está registado")

        utilizador = self._repo.criar(
            email=email,
            password_hash=hash_password(password),
            papel=papel,
            nome_completo=nome_completo,
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

        # Só depois de confirmar que a password está certa: aqui já não há
        # razão para esconder a causa (ver EmailNaoConfirmadoError).
        if not utilizador.email_confirmado:
            raise EmailNaoConfirmadoError("confirme o seu email antes de entrar")

        return SessaoIniciada(utilizador=utilizador, tokens=self._emitir_tokens(utilizador.id))

    def entrar_com_google(self, perfil: PerfilGoogle) -> SessaoIniciada:
        """`perfil` já vem de um token verificado criptograficamente (ver
        core/google_auth.py) — aqui só as regras de negócio: ligar a uma
        conta existente pelo email (decisão do dono do projecto: o Google já
        provou a posse do email, é seguro ligar automaticamente, sem exigir
        a password original) ou criar uma conta nova, sempre `papel: comum`
        (os outros papéis nunca se auto-atribuem, mesma regra do registo
        normal — ver PAPEIS_AUTO_REGISTAVEIS). Uma conta que ainda não
        tivesse confirmado o email por link (AUTH-02) fica confirmada aqui
        também: a verificação do Google é pelo menos tão forte quanto isso.
        """
        if not perfil.email_verificado:
            raise EmailGoogleNaoVerificadoError(perfil.email)

        utilizador = self._repo.obter_por_email(perfil.email)
        if utilizador is None:
            utilizador = self._repo.criar(
                email=perfil.email,
                password_hash=hash_password(_gerar_password_aleatoria()),
                papel="comum",
                nome_completo=perfil.nome,
            )

        if not utilizador.email_confirmado:
            self._repo.confirmar_email(utilizador.id)
            utilizador = self._repo.obter_por_id(utilizador.id)

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
