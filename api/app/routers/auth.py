"""Router de autenticação — recebe o pedido HTTP, valida a entrada (Pydantic
já fez isso antes de chegar aqui), chama o service, traduz o resultado (ou o
erro de domínio) para uma resposta HTTP. Nunca fala com a base de dados
directamente.

A sessão viaja em dois cookies `httpOnly` (`access_token`, `refresh_token`),
nunca no corpo JSON — ver nota em app/schemas/auth.py.
"""

import logging

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.cookies import definir_cookie_acesso, definir_cookies_sessao, limpar_cookies_sessao
from app.core.dependencies import obter_auth_service, obter_conta_service, obter_utilizador_atual
from app.core.security import TokenGoogleInvalidoError, verificar_id_token_google
from app.db import obter_sessao
from app.repositories.email_sender import ResendEmailSender
from app.repositories.tokens_email_repository import SQLAlchemyTokensEmailRepository
from app.repositories.utilizadores_repository import (
    SQLAlchemyUtilizadoresRepository,
    UtilizadorRegisto,
)
from app.schemas.auth import (
    ConfirmarEmailPedido,
    GoogleEntrada,
    RecuperarPasswordPedido,
    RedefinirPasswordPedido,
    UtilizadorCriar,
    UtilizadorLogin,
    UtilizadorPublico,
)
from app.services.auth_service import (
    AuthService,
    CredenciaisInvalidasError,
    EmailGoogleNaoVerificadoError,
    EmailJaRegistadoError,
    RefreshTokenInvalidoError,
)
from app.services.conta_service import ContaService
from app.services.verificacao_email_service import (
    TokenEmailExpiradoError,
    TokenEmailInvalidoError,
    TokenEmailJaUsadoError,
    VerificacaoEmailService,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


def obter_verificacao_email_service(
    sessao: Session = Depends(obter_sessao),
) -> VerificacaoEmailService:
    return VerificacaoEmailService(
        SQLAlchemyUtilizadoresRepository(sessao),
        SQLAlchemyTokensEmailRepository(sessao),
        ResendEmailSender(),
    )


def _utilizador_publico(utilizador: UtilizadorRegisto, eliminacao_cancelada: bool = False) -> UtilizadorPublico:
    return UtilizadorPublico(
        id=utilizador.id,
        email=utilizador.email,
        papel=utilizador.papel,
        nome_completo=utilizador.nome_completo,
        provincia=utilizador.provincia,
        genero=utilizador.genero,
        email_confirmado=utilizador.email_confirmado,
        criado_em=utilizador.criado_em,
        eliminacao_cancelada=eliminacao_cancelada,
    )


@router.post("/registar", response_model=UtilizadorPublico, status_code=status.HTTP_201_CREATED)
def registar(
    dados: UtilizadorCriar,
    response: Response,
    service: AuthService = Depends(obter_auth_service),
    verificacao: VerificacaoEmailService = Depends(obter_verificacao_email_service),
) -> UtilizadorPublico:
    try:
        sessao = service.registar(
            dados.email,
            dados.password,
            papel=dados.papel,
            nome_completo=dados.nome_completo,
            provincia=dados.provincia,
            genero=dados.genero,
        )
    except EmailJaRegistadoError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    definir_cookies_sessao(response, sessao.tokens)

    # Best-effort: a conta já está criada e válida: se o envio do email de
    # confirmação falhar (Resend em baixo, chave por configurar), isso não
    # pode desfazer um registo que já aconteceu. A conta fica por confirmar
    # e pode pedir reenvio mais tarde.
    try:
        verificacao.solicitar_confirmacao_conta(sessao.utilizador.id, sessao.utilizador.email)
    except Exception:
        logger.exception("falha ao enviar o email de confirmação de conta")

    return _utilizador_publico(sessao.utilizador)


@router.post("/entrar", response_model=UtilizadorPublico)
def entrar(
    dados: UtilizadorLogin,
    response: Response,
    service: AuthService = Depends(obter_auth_service),
    conta_service: ContaService = Depends(obter_conta_service),
) -> UtilizadorPublico:
    try:
        sessao = service.autenticar(dados.email, dados.password)
    except CredenciaisInvalidasError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    definir_cookies_sessao(response, sessao.tokens)
    # Voltar a entrar dentro do período de carência cancela um pedido de
    # eliminação — é o sinal mais claro possível de "mudei de ideias".
    cancelada = conta_service.cancelar_eliminacao_se_agendada(sessao.utilizador.id)
    return _utilizador_publico(sessao.utilizador, eliminacao_cancelada=cancelada)


@router.post("/google", response_model=UtilizadorPublico)
def entrar_com_google(
    dados: GoogleEntrada,
    response: Response,
    service: AuthService = Depends(obter_auth_service),
) -> UtilizadorPublico:
    try:
        info = verificar_id_token_google(dados.credential)
    except TokenGoogleInvalidoError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    try:
        sessao = service.autenticar_com_google(info)
    except EmailGoogleNaoVerificadoError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="este email já tem conta, mas a Google não confirma que lhe pertence",
        ) from exc

    definir_cookies_sessao(response, sessao.tokens)
    return _utilizador_publico(sessao.utilizador)


@router.get("/eu", response_model=UtilizadorPublico)
def eu(utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual)) -> UtilizadorPublico:
    return _utilizador_publico(utilizador)


@router.post("/sair", status_code=status.HTTP_204_NO_CONTENT)
def sair(response: Response) -> None:
    # Sem verificar sessão de propósito — sair nunca deve poder falhar por
    # já não haver sessão válida; o objectivo (cookies limpos) é sempre
    # alcançado.
    limpar_cookies_sessao(response)


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

    definir_cookie_acesso(response, novo_access_token)


@router.post("/recuperar-password", status_code=status.HTTP_204_NO_CONTENT)
def recuperar_password(
    dados: RecuperarPasswordPedido,
    verificacao: VerificacaoEmailService = Depends(obter_verificacao_email_service),
) -> None:
    # Sempre 204, exista ou não o email -- nunca revelar isso a quem pede
    # (mesma filosofia de AuthService.autenticar). O service já garante que
    # não envia nada quando não há conta ou é uma conta só-Google.
    verificacao.solicitar_recuperacao_password(dados.email)


@router.post("/redefinir-password", status_code=status.HTTP_204_NO_CONTENT)
def redefinir_password(
    dados: RedefinirPasswordPedido,
    verificacao: VerificacaoEmailService = Depends(obter_verificacao_email_service),
) -> None:
    try:
        verificacao.redefinir_password(dados.token, dados.password_nova)
    except TokenEmailInvalidoError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="token inválido") from exc
    except TokenEmailJaUsadoError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="token já foi usado") from exc
    except TokenEmailExpiradoError as exc:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="token expirado") from exc


@router.post("/confirmar-email", status_code=status.HTTP_204_NO_CONTENT)
def confirmar_email(
    dados: ConfirmarEmailPedido,
    verificacao: VerificacaoEmailService = Depends(obter_verificacao_email_service),
) -> None:
    try:
        verificacao.confirmar_conta(dados.token)
    except TokenEmailInvalidoError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="token inválido") from exc
    except TokenEmailJaUsadoError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="token já foi usado") from exc
    except TokenEmailExpiradoError as exc:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="token expirado") from exc


@router.post("/reenviar-confirmacao", status_code=status.HTTP_204_NO_CONTENT)
def reenviar_confirmacao(
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    verificacao: VerificacaoEmailService = Depends(obter_verificacao_email_service),
) -> None:
    # Exige sessão (nunca anónimo) -- de resto seria um vector para
    # despoletar envios de email para qualquer endereço à vontade.
    verificacao.solicitar_confirmacao_conta(utilizador.id, utilizador.email)
