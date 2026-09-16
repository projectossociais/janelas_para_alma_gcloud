"""Router de autenticação — recebe o pedido HTTP, valida a entrada (Pydantic
já fez isso antes de chegar aqui), chama o service, traduz o resultado (ou o
erro de domínio) para uma resposta HTTP. Nunca fala com a base de dados
directamente.

A sessão viaja em dois cookies `httpOnly` (`access_token`, `refresh_token`),
nunca no corpo JSON — ver nota em app/schemas/auth.py.
"""

import sys

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status

from app.core.cookies import definir_cookie_acesso, definir_cookies_sessao, limpar_cookies_sessao
from app.core.dependencies import (
    obter_auth_service,
    obter_confirmacao_email_service,
    obter_conta_service,
    obter_google_verifier,
    obter_recuperacao_password_service,
    obter_utilizador_atual,
)
from app.core.email import EmailEnvioFalhouError
from app.core.google_auth import GoogleTokenVerifier, TokenGoogleInvalidoError
from app.repositories.utilizadores_repository import UtilizadorRegisto
from app.schemas.auth import (
    ConfirmarEmailPedido,
    GoogleLoginPedido,
    RedefinirPassword,
    ReenviarConfirmacaoPedido,
    SolicitarRecuperacaoPassword,
    UtilizadorCriar,
    UtilizadorLogin,
    UtilizadorPublico,
)
from app.services.auth_service import (
    AuthService,
    CredenciaisInvalidasError,
    EmailGoogleNaoVerificadoError,
    EmailJaRegistadoError,
    EmailNaoConfirmadoError,
    RefreshTokenInvalidoError,
)
from app.services.confirmacao_email_service import (
    ConfirmacaoEmailService,
    TokenConfirmacaoInvalidoError,
)
from app.services.conta_service import ContaService
from app.services.recuperacao_password_service import (
    RecuperacaoPasswordService,
    TokenRecuperacaoInvalidoError,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _utilizador_publico(utilizador: UtilizadorRegisto, eliminacao_cancelada: bool = False) -> UtilizadorPublico:
    return UtilizadorPublico(
        id=utilizador.id,
        email=utilizador.email,
        papel=utilizador.papel,
        nome_completo=utilizador.nome_completo,
        provincia=utilizador.provincia,
        genero=utilizador.genero,
        criado_em=utilizador.criado_em,
        email_confirmado=utilizador.email_confirmado,
        eliminacao_cancelada=eliminacao_cancelada,
    )


@router.post("/registar", response_model=UtilizadorPublico, status_code=status.HTTP_201_CREATED)
def registar(
    dados: UtilizadorCriar,
    service: AuthService = Depends(obter_auth_service),
    confirmacao_service: ConfirmacaoEmailService = Depends(obter_confirmacao_email_service),
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

    # AUTH-02: registar já não inicia sessão -- sem `definir_cookies_sessao`
    # de propósito. A conta existe (já commitada), mas fica por confirmar;
    # /auth/entrar recusa-a até o link chegar.
    try:
        confirmacao_service.enviar(sessao.utilizador)
    except EmailEnvioFalhouError as exc:
        # A conta já foi criada com sucesso -- um problema a enviar o email
        # não pode reverter isso, nem faz sentido devolver erro de registo
        # quando o registo, de facto, correu bem. Fica registado no stderr;
        # o utilizador tem sempre a via de /auth/reenviar-confirmacao.
        print(f"[confirmacao-email] falha a enviar para {sessao.utilizador.email}: {exc}", file=sys.stderr)

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
    except EmailNaoConfirmadoError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except CredenciaisInvalidasError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    definir_cookies_sessao(response, sessao.tokens)
    # Voltar a entrar dentro do período de carência cancela um pedido de
    # eliminação — é o sinal mais claro possível de "mudei de ideias".
    cancelada = conta_service.cancelar_eliminacao_se_agendada(sessao.utilizador.id)
    return _utilizador_publico(sessao.utilizador, eliminacao_cancelada=cancelada)


@router.post("/google", response_model=UtilizadorPublico)
def entrar_com_google(
    dados: GoogleLoginPedido,
    response: Response,
    verificador: GoogleTokenVerifier = Depends(obter_google_verifier),
    service: AuthService = Depends(obter_auth_service),
    conta_service: ContaService = Depends(obter_conta_service),
) -> UtilizadorPublico:
    try:
        perfil = verificador.verificar(dados.id_token)
    except TokenGoogleInvalidoError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    try:
        sessao = service.entrar_com_google(perfil)
    except EmailGoogleNaoVerificadoError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="o Google não confirma que este email é seu",
        ) from exc

    definir_cookies_sessao(response, sessao.tokens)
    cancelada = conta_service.cancelar_eliminacao_se_agendada(sessao.utilizador.id)
    return _utilizador_publico(sessao.utilizador, eliminacao_cancelada=cancelada)


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


@router.post("/recuperar-password", status_code=status.HTTP_202_ACCEPTED)
def recuperar_password(
    dados: SolicitarRecuperacaoPassword,
    service: RecuperacaoPasswordService = Depends(obter_recuperacao_password_service),
) -> dict[str, str]:
    # Resposta sempre igual, exista ou não conta com este email — nunca deixar
    # que este endpoint sirva para confirmar a um atacante se um email está
    # registado (ver RecuperacaoPasswordService.solicitar).
    service.solicitar(dados.email)
    return {"mensagem": "Se existir uma conta com este email, foi enviado um link de recuperação."}


@router.post("/redefinir-password", status_code=status.HTTP_204_NO_CONTENT)
def redefinir_password(
    dados: RedefinirPassword,
    service: RecuperacaoPasswordService = Depends(obter_recuperacao_password_service),
) -> None:
    try:
        service.redefinir(dados.token, dados.password_nova)
    except TokenRecuperacaoInvalidoError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/confirmar-email", status_code=status.HTTP_204_NO_CONTENT)
def confirmar_email(
    dados: ConfirmarEmailPedido,
    service: ConfirmacaoEmailService = Depends(obter_confirmacao_email_service),
) -> None:
    try:
        service.confirmar(dados.token)
    except TokenConfirmacaoInvalidoError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/reenviar-confirmacao", status_code=status.HTTP_202_ACCEPTED)
def reenviar_confirmacao(
    dados: ReenviarConfirmacaoPedido,
    service: ConfirmacaoEmailService = Depends(obter_confirmacao_email_service),
) -> dict[str, str]:
    # Resposta sempre igual, exista ou não a conta, esteja ou não já
    # confirmada — mesmo princípio de /auth/recuperar-password.
    service.reenviar(dados.email)
    return {"mensagem": "Se existir uma conta por confirmar com este email, foi enviado um novo link."}
