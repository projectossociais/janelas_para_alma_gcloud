"""Router de autenticação — recebe o pedido HTTP, valida a entrada (Pydantic
já fez isso antes de chegar aqui), chama o service, traduz o resultado (ou o
erro de domínio) para uma resposta HTTP. Nunca fala com a base de dados
directamente.

A sessão viaja em dois cookies `httpOnly` (`access_token`, `refresh_token`),
nunca no corpo JSON — ver nota em app/schemas/auth.py.
"""

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status

from app.core.cookies import definir_cookie_acesso, definir_cookies_sessao, limpar_cookies_sessao
from app.core.dependencies import (
    obter_auth_service,
    obter_conta_service,
    obter_recuperacao_password_service,
    obter_utilizador_atual,
)
from app.repositories.utilizadores_repository import UtilizadorRegisto
from app.schemas.auth import (
    RedefinirPassword,
    SolicitarRecuperacaoPassword,
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
        eliminacao_cancelada=eliminacao_cancelada,
    )


@router.post("/registar", response_model=UtilizadorPublico, status_code=status.HTTP_201_CREATED)
def registar(
    dados: UtilizadorCriar, response: Response, service: AuthService = Depends(obter_auth_service)
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
