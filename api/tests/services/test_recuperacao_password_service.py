"""Testes do serviço de recuperação de password — repositórios e emissor de
email falsos, sem base de dados nem rede nenhuma (ver CLAUDE.md, "Unitário
vs integração"). O caminho do erro pesa tanto como o do sucesso: um token
que pudesse ser reutilizado, ou uma resposta que revelasse se um email
existe, seriam os dois piores bugs possíveis aqui.
"""

from datetime import UTC, datetime, timedelta

import pytest

from app.core.email import EmailEnvioFalhouError
from app.services.auth_service import AuthService
from app.services.recuperacao_password_service import (
    RecuperacaoPasswordService,
    TokenRecuperacaoInvalidoError,
    _hash_token,
)
from tests.services.test_auth_service import RepositorioFalso


class TokensRepositorioFalso:
    """Implementa o mesmo contrato (Protocol) que o repositório real."""

    def __init__(self) -> None:
        self._tokens: dict[str, dict] = {}
        self._seq = 0

    def criar(self, utilizador_id: str, token_hash: str, expira_em: datetime):
        from app.repositories.tokens_recuperacao_repository import TokenRecuperacaoRegisto

        self._seq += 1
        registo = TokenRecuperacaoRegisto(
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


class EmailSenderFalso:
    """Nunca chama rede nenhuma — só regista o que lhe pediram para enviar,
    para os testes conseguirem inspeccionar o link gerado."""

    def __init__(self, falha: bool = False) -> None:
        self.enviados: list[dict] = []
        self._falha = falha

    def enviar(self, destinatario: str, assunto: str, corpo_html: str) -> None:
        if self._falha:
            raise EmailEnvioFalhouError("falha simulada do Resend")
        self.enviados.append({"destinatario": destinatario, "assunto": assunto, "corpo_html": corpo_html})


@pytest.fixture
def utilizadores_repo() -> RepositorioFalso:
    return RepositorioFalso()


@pytest.fixture
def tokens_repo() -> TokensRepositorioFalso:
    return TokensRepositorioFalso()


@pytest.fixture
def email_sender() -> EmailSenderFalso:
    return EmailSenderFalso()


@pytest.fixture
def utilizador_existente(utilizadores_repo: RepositorioFalso):
    auth = AuthService(utilizadores_repo)
    return auth.registar("ana@example.com", "password-forte-123").utilizador


def test_solicitar_com_email_existente_envia_um_email_com_link(
    utilizadores_repo, tokens_repo, email_sender, utilizador_existente
) -> None:
    service = RecuperacaoPasswordService(utilizadores_repo, tokens_repo, email_sender)

    resultado = service.solicitar("ana@example.com")

    assert resultado.email_enviado is True
    assert len(email_sender.enviados) == 1
    assert email_sender.enviados[0]["destinatario"] == "ana@example.com"
    assert "/atualizar-password?token=" in email_sender.enviados[0]["corpo_html"]


def test_solicitar_com_email_inexistente_nao_envia_nada_mas_nao_falha(
    utilizadores_repo, tokens_repo, email_sender
) -> None:
    # Comportamento idêntico ao chamador em ambos os casos — só o resultado
    # interno (nunca exposto na resposta HTTP) distingue os dois.
    service = RecuperacaoPasswordService(utilizadores_repo, tokens_repo, email_sender)

    resultado = service.solicitar("ninguem@example.com")

    assert resultado.email_enviado is False
    assert email_sender.enviados == []


def test_solicitar_propaga_falha_real_do_envio_em_vez_de_fingir_sucesso(
    utilizadores_repo, tokens_repo, utilizador_existente
) -> None:
    # Nunca mostrar sucesso quando o Resend falhou de verdade (CLAUDE.md,
    # "nunca mostrar sucesso antes de verificar erro") — distinto do caso
    # "email não existe", que É sucesso do ponto de vista do chamador.
    email_sender_com_falha = EmailSenderFalso(falha=True)
    service = RecuperacaoPasswordService(utilizadores_repo, tokens_repo, email_sender_com_falha)

    with pytest.raises(EmailEnvioFalhouError):
        service.solicitar("ana@example.com")


def test_redefinir_com_token_valido_muda_a_password(
    utilizadores_repo, tokens_repo, email_sender, utilizador_existente
) -> None:
    service = RecuperacaoPasswordService(utilizadores_repo, tokens_repo, email_sender)
    service.solicitar("ana@example.com")
    token_em_claro = email_sender.enviados[0]["corpo_html"].split("token=")[1].split('"')[0]

    service.redefinir(token_em_claro, "password-nova-456")

    auth = AuthService(utilizadores_repo)
    sessao = auth.autenticar("ana@example.com", "password-nova-456")
    assert sessao.utilizador.email == "ana@example.com"


def test_redefinir_com_token_ja_usado_falha(
    utilizadores_repo, tokens_repo, email_sender, utilizador_existente
) -> None:
    service = RecuperacaoPasswordService(utilizadores_repo, tokens_repo, email_sender)
    service.solicitar("ana@example.com")
    token_em_claro = email_sender.enviados[0]["corpo_html"].split("token=")[1].split('"')[0]
    service.redefinir(token_em_claro, "password-nova-456")

    with pytest.raises(TokenRecuperacaoInvalidoError):
        service.redefinir(token_em_claro, "outra-password-789")


def test_redefinir_com_token_expirado_falha(utilizadores_repo, tokens_repo, email_sender, utilizador_existente) -> None:
    service = RecuperacaoPasswordService(utilizadores_repo, tokens_repo, email_sender)
    tokens_repo.criar(
        utilizador_existente.id,
        _hash_token("token-expirado"),
        datetime.now(UTC) - timedelta(minutes=1),
    )

    with pytest.raises(TokenRecuperacaoInvalidoError):
        service.redefinir("token-expirado", "password-nova-456")


def test_redefinir_com_token_desconhecido_falha(utilizadores_repo, tokens_repo, email_sender) -> None:
    service = RecuperacaoPasswordService(utilizadores_repo, tokens_repo, email_sender)

    with pytest.raises(TokenRecuperacaoInvalidoError):
        service.redefinir("token-que-nunca-existiu", "password-nova-456")
