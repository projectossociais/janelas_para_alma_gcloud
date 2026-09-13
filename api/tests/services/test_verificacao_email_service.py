"""Testes dos fluxos de recuperação de password e confirmação de conta.

O caminho do erro pesa tanto como o do sucesso: um token errado, expirado ou
já usado tem de ser recusado; um pedido de recuperação para um email que não
existe (ou que é só-Google) nunca pode revelar isso a quem pergunta.
"""

from dataclasses import replace
from datetime import UTC, datetime, timedelta

import pytest

from app.core.config import obter_settings
from app.repositories.tokens_email_repository import TokenEmailRegisto
from app.services.verificacao_email_service import (
    TokenEmailExpiradoError,
    TokenEmailInvalidoError,
    TokenEmailJaUsadoError,
    VerificacaoEmailService,
    _hash_token,
)
from tests.services.test_auth_service import RepositorioFalso


class RepositorioTokensFalso:
    def __init__(self) -> None:
        self._tokens: dict[str, TokenEmailRegisto] = {}
        self._seq = 0

    def criar(self, user_id: str, tipo, token_hash: str, expira_em: datetime) -> TokenEmailRegisto:
        self._seq += 1
        registo = TokenEmailRegisto(
            id=f"token-{self._seq}", user_id=user_id, tipo=tipo, expira_em=expira_em, usado_em=None
        )
        self._tokens[token_hash] = registo
        return registo

    def obter_por_hash(self, token_hash: str) -> TokenEmailRegisto | None:
        return self._tokens.get(token_hash)

    def marcar_usado(self, token_id: str, quando: datetime) -> None:
        for h, t in self._tokens.items():
            if t.id == token_id:
                self._tokens[h] = replace(t, usado_em=quando)
                return


class EmailSenderFalso:
    def __init__(self) -> None:
        self.enviados: list[dict] = []

    def enviar(self, destinatario: str, assunto: str, corpo_html: str) -> None:
        self.enviados.append({"destinatario": destinatario, "assunto": assunto, "corpo_html": corpo_html})


@pytest.fixture
def ambiente():
    repo_utilizadores = RepositorioFalso()
    repo_tokens = RepositorioTokensFalso()
    sender = EmailSenderFalso()
    service = VerificacaoEmailService(repo_utilizadores, repo_tokens, sender)
    return service, repo_utilizadores, repo_tokens, sender


class TestSolicitarRecuperacaoPassword:
    def test_envia_email_com_link_para_um_email_existente(self, ambiente) -> None:
        service, repo_utilizadores, repo_tokens, sender = ambiente
        repo_utilizadores.criar("ana@example.com", "hash-qualquer")

        service.solicitar_recuperacao_password("ana@example.com")

        assert len(sender.enviados) == 1
        assert sender.enviados[0]["destinatario"] == "ana@example.com"
        assert "atualizar-password?token=" in sender.enviados[0]["corpo_html"]
        assert len(repo_tokens._tokens) == 1

    def test_nao_envia_nem_revela_nada_para_email_inexistente(self, ambiente) -> None:
        service, _, repo_tokens, sender = ambiente

        service.solicitar_recuperacao_password("fantasma@example.com")

        assert sender.enviados == []
        assert repo_tokens._tokens == {}

    def test_nao_envia_para_conta_so_google_sem_password(self, ambiente) -> None:
        service, repo_utilizadores, _, sender = ambiente
        repo_utilizadores.criar_via_google("ana@example.com", "sub-1", "Ana")

        service.solicitar_recuperacao_password("ana@example.com")

        assert sender.enviados == []


class TestRedefinirPassword:
    def test_token_valido_muda_a_password(self, ambiente) -> None:
        service, repo_utilizadores, _, sender = ambiente
        repo_utilizadores.criar("ana@example.com", "hash-antigo")
        service.solicitar_recuperacao_password("ana@example.com")
        token_bruto = sender.enviados[0]["corpo_html"].split("token=")[1].split('"')[0]

        service.redefinir_password(token_bruto, "nova-password-forte-123")

        novo = repo_utilizadores.obter_por_email("ana@example.com")
        assert novo.password_hash != "hash-antigo"

    def test_token_inexistente_e_recusado(self, ambiente) -> None:
        service, *_ = ambiente
        with pytest.raises(TokenEmailInvalidoError):
            service.redefinir_password("token-que-nao-existe", "nova-password-123")

    def test_token_de_confirmacao_nao_serve_para_redefinir_password(self, ambiente) -> None:
        # Um token de "confirmacao_conta" tem de ser recusado aqui, mesmo
        # que exista e esteja válido -- os dois tipos não são intercambiáveis.
        service, repo_utilizadores, _, sender = ambiente
        utilizador = repo_utilizadores.criar("ana@example.com", "hash")
        service.solicitar_confirmacao_conta(utilizador.id, "ana@example.com")
        token_confirmacao = sender.enviados[0]["corpo_html"].split("token=")[1].split('"')[0]

        with pytest.raises(TokenEmailInvalidoError):
            service.redefinir_password(token_confirmacao, "nova-password-123")

    def test_token_ja_usado_e_recusado(self, ambiente) -> None:
        service, repo_utilizadores, _, sender = ambiente
        repo_utilizadores.criar("ana@example.com", "hash")
        service.solicitar_recuperacao_password("ana@example.com")
        token_bruto = sender.enviados[0]["corpo_html"].split("token=")[1].split('"')[0]
        service.redefinir_password(token_bruto, "primeira-password-nova-123")

        with pytest.raises(TokenEmailJaUsadoError):
            service.redefinir_password(token_bruto, "segunda-password-nova-456")

    def test_token_expirado_e_recusado(self, ambiente) -> None:
        service, repo_utilizadores, repo_tokens, _ = ambiente
        utilizador = repo_utilizadores.criar("ana@example.com", "hash")
        token_bruto = "token-de-teste"
        repo_tokens.criar(
            utilizador.id,
            "recuperacao_password",
            _hash_token(token_bruto),
            expira_em=datetime.now(UTC) - timedelta(seconds=1),
        )

        with pytest.raises(TokenEmailExpiradoError):
            service.redefinir_password(token_bruto, "nova-password-123")


class TestConfirmarConta:
    def test_token_valido_marca_a_conta_como_confirmada(self, ambiente) -> None:
        service, repo_utilizadores, _, sender = ambiente
        utilizador = repo_utilizadores.criar("ana@example.com", "hash")
        assert utilizador.email_confirmado is False
        service.solicitar_confirmacao_conta(utilizador.id, "ana@example.com")
        token_bruto = sender.enviados[0]["corpo_html"].split("token=")[1].split('"')[0]

        service.confirmar_conta(token_bruto)

        assert repo_utilizadores.obter_por_email("ana@example.com").email_confirmado is True

    def test_token_de_recuperacao_nao_serve_para_confirmar_conta(self, ambiente) -> None:
        service, repo_utilizadores, _, sender = ambiente
        repo_utilizadores.criar("ana@example.com", "hash")
        service.solicitar_recuperacao_password("ana@example.com")
        token_recuperacao = sender.enviados[0]["corpo_html"].split("token=")[1].split('"')[0]

        with pytest.raises(TokenEmailInvalidoError):
            service.confirmar_conta(token_recuperacao)

    def test_usar_o_token_duas_vezes_e_recusado_na_segunda(self, ambiente) -> None:
        service, repo_utilizadores, _, sender = ambiente
        utilizador = repo_utilizadores.criar("ana@example.com", "hash")
        service.solicitar_confirmacao_conta(utilizador.id, "ana@example.com")
        token_bruto = sender.enviados[0]["corpo_html"].split("token=")[1].split('"')[0]
        service.confirmar_conta(token_bruto)

        with pytest.raises(TokenEmailJaUsadoError):
            service.confirmar_conta(token_bruto)


def test_respeita_a_validade_configurada_em_settings(ambiente, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(obter_settings(), "token_recuperacao_password_horas", 2)
    service, repo_utilizadores, repo_tokens, _ = ambiente
    utilizador = repo_utilizadores.criar("ana@example.com", "hash")
    antes = datetime.now(UTC)

    service.solicitar_recuperacao_password("ana@example.com")

    registo = next(iter(repo_tokens._tokens.values()))
    assert registo.user_id == utilizador.id
    janela = registo.expira_em - antes
    assert timedelta(hours=1, minutes=59) < janela <= timedelta(hours=2, seconds=2)
