"""Testes do serviço de confirmação de email (AUTH-02) — repositórios e
emissor de email falsos, sem base de dados nem rede. Ao contrário da
recuperação de password, `enviar()` aqui nunca esconde nada (é sempre
chamado com um utilizador que se sabe existir, logo após o registo) — só
`reenviar()` tem a preocupação de não revelar se uma conta existe.
"""

from datetime import UTC, datetime, timedelta

import pytest

from app.core.email import EmailEnvioFalhouError
from app.services.auth_service import AuthService
from app.services.confirmacao_email_service import (
    ConfirmacaoEmailService,
    TokenConfirmacaoInvalidoError,
    _hash_token,
)
from tests.services.test_auth_service import RepositorioFalso
from tests.services.test_recuperacao_password_service import EmailSenderFalso


class TokensConfirmacaoRepositorioFalso:
    """Implementa o mesmo contrato (Protocol) que o repositório real."""

    def __init__(self) -> None:
        self._tokens: dict[str, dict] = {}
        self._seq = 0

    def criar(self, utilizador_id: str, token_hash: str, expira_em: datetime):
        from app.repositories.tokens_confirmacao_repository import TokenConfirmacaoRegisto

        self._seq += 1
        registo = TokenConfirmacaoRegisto(
            id=f"token-{self._seq}",
            utilizador_id=utilizador_id,
            token_hash=token_hash,
            expira_em=expira_em,
            usado_em=None,
        )
        self._tokens[token_hash] = registo
        return registo

    def obter_por_hash(self, token_hash: str):
        return self._tokens.get(token_hash)

    def marcar_usado(self, token_id: str, quando: datetime) -> None:
        for token_hash, registo in list(self._tokens.items()):
            if registo.id == token_id:
                self._tokens[token_hash] = type(registo)(
                    id=registo.id,
                    utilizador_id=registo.utilizador_id,
                    token_hash=registo.token_hash,
                    expira_em=registo.expira_em,
                    usado_em=quando,
                )


@pytest.fixture
def utilizadores_repo() -> RepositorioFalso:
    return RepositorioFalso()


@pytest.fixture
def tokens_repo() -> TokensConfirmacaoRepositorioFalso:
    return TokensConfirmacaoRepositorioFalso()


@pytest.fixture
def email_sender() -> EmailSenderFalso:
    return EmailSenderFalso()


@pytest.fixture
def utilizador_registado(utilizadores_repo: RepositorioFalso):
    auth = AuthService(utilizadores_repo)
    return auth.registar("ana@example.com", "password-forte-123").utilizador


def _extrair_token(email_sender: EmailSenderFalso) -> str:
    return email_sender.enviados[-1]["corpo_html"].split("token=")[1].split('"')[0]


def test_enviar_manda_um_email_com_link_de_confirmacao(
    utilizadores_repo, tokens_repo, email_sender, utilizador_registado
) -> None:
    service = ConfirmacaoEmailService(utilizadores_repo, tokens_repo, email_sender)

    service.enviar(utilizador_registado)

    assert len(email_sender.enviados) == 1
    assert email_sender.enviados[0]["destinatario"] == "ana@example.com"
    assert "/confirmar-email?token=" in email_sender.enviados[0]["corpo_html"]


def test_enviar_propaga_falha_real_do_envio(utilizadores_repo, tokens_repo, utilizador_registado) -> None:
    email_sender_com_falha = EmailSenderFalso(falha=True)
    service = ConfirmacaoEmailService(utilizadores_repo, tokens_repo, email_sender_com_falha)

    with pytest.raises(EmailEnvioFalhouError):
        service.enviar(utilizador_registado)


def test_confirmar_com_token_valido_marca_a_conta_como_confirmada(
    utilizadores_repo, tokens_repo, email_sender, utilizador_registado
) -> None:
    service = ConfirmacaoEmailService(utilizadores_repo, tokens_repo, email_sender)
    service.enviar(utilizador_registado)
    token = _extrair_token(email_sender)

    service.confirmar(token)

    utilizador_atualizado = utilizadores_repo.obter_por_id(utilizador_registado.id)
    assert utilizador_atualizado.email_confirmado is True


def test_confirmar_com_token_ja_usado_falha(
    utilizadores_repo, tokens_repo, email_sender, utilizador_registado
) -> None:
    service = ConfirmacaoEmailService(utilizadores_repo, tokens_repo, email_sender)
    service.enviar(utilizador_registado)
    token = _extrair_token(email_sender)
    service.confirmar(token)

    with pytest.raises(TokenConfirmacaoInvalidoError):
        service.confirmar(token)


def test_confirmar_com_token_expirado_falha(
    utilizadores_repo, tokens_repo, email_sender, utilizador_registado
) -> None:
    service = ConfirmacaoEmailService(utilizadores_repo, tokens_repo, email_sender)
    tokens_repo.criar(
        utilizador_registado.id,
        _hash_token("token-expirado"),
        datetime.now(UTC) - timedelta(minutes=1),
    )

    with pytest.raises(TokenConfirmacaoInvalidoError):
        service.confirmar("token-expirado")


def test_confirmar_com_token_desconhecido_falha(utilizadores_repo, tokens_repo, email_sender) -> None:
    service = ConfirmacaoEmailService(utilizadores_repo, tokens_repo, email_sender)

    with pytest.raises(TokenConfirmacaoInvalidoError):
        service.confirmar("token-que-nunca-existiu")


def test_reenviar_com_conta_por_confirmar_manda_novo_email(
    utilizadores_repo, tokens_repo, email_sender, utilizador_registado
) -> None:
    service = ConfirmacaoEmailService(utilizadores_repo, tokens_repo, email_sender)

    resultado = service.reenviar("ana@example.com")

    assert resultado.email_enviado is True
    assert len(email_sender.enviados) == 1


def test_reenviar_com_email_inexistente_nao_envia_nada_mas_nao_falha(
    utilizadores_repo, tokens_repo, email_sender
) -> None:
    service = ConfirmacaoEmailService(utilizadores_repo, tokens_repo, email_sender)

    resultado = service.reenviar("ninguem@example.com")

    assert resultado.email_enviado is False
    assert email_sender.enviados == []


def test_reenviar_com_conta_ja_confirmada_nao_envia_nada(
    utilizadores_repo, tokens_repo, email_sender, utilizador_registado
) -> None:
    utilizadores_repo.confirmar_email(utilizador_registado.id)
    service = ConfirmacaoEmailService(utilizadores_repo, tokens_repo, email_sender)

    resultado = service.reenviar("ana@example.com")

    assert resultado.email_enviado is False
    assert email_sender.enviados == []
