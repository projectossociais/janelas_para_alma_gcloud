"""Testes do `CandidaturaVoluntariadoService`.

Ao contrário das doações, aqui uma falha no envio do email **não** desfaz a
decisão já gravada — é a decisão de desenho documentada no topo do service.
"""

from datetime import UTC, datetime

import pytest

from app.core.email import EmailEnvioFalhouError
from app.repositories.candidatura_voluntariado_repository import CandidaturaVoluntariadoRegisto
from app.services.candidatura_voluntariado_service import (
    CandidaturaJaDecididaError,
    CandidaturaJaExisteError,
    CandidaturaNaoEncontradaError,
    CandidaturaVoluntariadoService,
)


def _candidatura(**over) -> CandidaturaVoluntariadoRegisto:
    base = {
        "id": "cand-1",
        "utilizador_id": "user-1",
        "utilizador_email": "ana@example.com",
        "utilizador_nome": "Ana",
        "motivacao": "Quero ajudar",
        "telefone": None,
        "status": "pendente",
        "decidido_por": None,
        "decidido_em": None,
        "created_at": datetime.now(UTC),
    }
    base.update(over)
    return CandidaturaVoluntariadoRegisto(**base)


class RepositorioFalso:
    def __init__(self, existente: CandidaturaVoluntariadoRegisto | None = None) -> None:
        self._existente = existente
        self.criada: dict | None = None
        self.aprovada: dict | None = None
        self.rejeitada: dict | None = None

    def obter_por_utilizador(self, utilizador_id: str) -> CandidaturaVoluntariadoRegisto | None:
        return self._existente if self._existente and self._existente.utilizador_id == utilizador_id else None

    def criar(self, utilizador_id, motivacao, telefone) -> CandidaturaVoluntariadoRegisto:
        self.criada = {"utilizador_id": utilizador_id, "motivacao": motivacao, "telefone": telefone}
        return _candidatura(utilizador_id=utilizador_id, motivacao=motivacao, telefone=telefone)

    def obter(self, candidatura_id: str) -> CandidaturaVoluntariadoRegisto | None:
        return self._existente if self._existente and self._existente.id == candidatura_id else None

    def aprovar(self, candidatura_id, admin_id, quando) -> CandidaturaVoluntariadoRegisto:
        self.aprovada = {"candidatura_id": candidatura_id, "admin_id": admin_id, "quando": quando}
        return _candidatura(status="aprovada", decidido_por=admin_id, decidido_em=quando)

    def rejeitar(self, candidatura_id, admin_id, quando) -> CandidaturaVoluntariadoRegisto:
        self.rejeitada = {"candidatura_id": candidatura_id, "admin_id": admin_id, "quando": quando}
        return _candidatura(status="rejeitada", decidido_por=admin_id, decidido_em=quando)

    def listar(self):  # pragma: no cover
        raise NotImplementedError


class EmailSenderFalso:
    def __init__(self, falha: bool = False) -> None:
        self.enviados: list[dict] = []
        self._falha = falha

    def enviar(self, destinatario: str, assunto: str, corpo_html: str) -> None:
        if self._falha:
            raise EmailEnvioFalhouError("falha simulada do Resend")
        self.enviados.append({"destinatario": destinatario, "assunto": assunto, "corpo_html": corpo_html})


class TestCandidatar:
    def test_cria_candidatura_pendente(self) -> None:
        repo = RepositorioFalso()
        resultado = CandidaturaVoluntariadoService(repo, EmailSenderFalso()).candidatar(
            "user-1", "Quero ajudar", "+244900000000"
        )
        assert resultado.status == "pendente"
        assert repo.criada["motivacao"] == "Quero ajudar"

    def test_envia_email_de_confirmacao(self) -> None:
        repo = RepositorioFalso()
        email_sender = EmailSenderFalso()
        CandidaturaVoluntariadoService(repo, email_sender).candidatar("user-1", "Quero ajudar", None)
        assert len(email_sender.enviados) == 1
        assert email_sender.enviados[0]["destinatario"] == "ana@example.com"

    def test_falha_no_email_nao_impede_a_candidatura(self) -> None:
        # Ao contrário das doações: a candidatura já gravada é o que importa.
        repo = RepositorioFalso()
        resultado = CandidaturaVoluntariadoService(repo, EmailSenderFalso(falha=True)).candidatar(
            "user-1", "Quero ajudar", None
        )
        assert resultado.status == "pendente"

    def test_recusa_segunda_candidatura_enquanto_a_primeira_esta_pendente(self) -> None:
        repo = RepositorioFalso(existente=_candidatura(status="pendente"))
        with pytest.raises(CandidaturaJaExisteError):
            CandidaturaVoluntariadoService(repo, EmailSenderFalso()).candidatar("user-1", "De novo", None)

    def test_recusa_segunda_candidatura_se_ja_aprovada(self) -> None:
        repo = RepositorioFalso(existente=_candidatura(status="aprovada"))
        with pytest.raises(CandidaturaJaExisteError):
            CandidaturaVoluntariadoService(repo, EmailSenderFalso()).candidatar("user-1", "De novo", None)

    def test_permite_nova_candidatura_apos_rejeicao(self) -> None:
        repo = RepositorioFalso(existente=_candidatura(status="rejeitada"))
        resultado = CandidaturaVoluntariadoService(repo, EmailSenderFalso()).candidatar(
            "user-1", "Tento outra vez", None
        )
        assert resultado.status == "pendente"


class TestAprovar:
    def test_aprova_e_notifica(self) -> None:
        repo = RepositorioFalso(existente=_candidatura())
        email_sender = EmailSenderFalso()
        resultado = CandidaturaVoluntariadoService(repo, email_sender).aprovar("cand-1", "admin-9")

        assert resultado.status == "aprovada"
        assert repo.aprovada["admin_id"] == "admin-9"
        assert len(email_sender.enviados) == 1

    def test_candidatura_inexistente(self) -> None:
        repo = RepositorioFalso(existente=None)
        with pytest.raises(CandidaturaNaoEncontradaError):
            CandidaturaVoluntariadoService(repo, EmailSenderFalso()).aprovar("cand-1", "admin-9")

    def test_nao_decide_duas_vezes(self) -> None:
        repo = RepositorioFalso(existente=_candidatura(status="aprovada"))
        with pytest.raises(CandidaturaJaDecididaError):
            CandidaturaVoluntariadoService(repo, EmailSenderFalso()).aprovar("cand-1", "admin-9")
        assert repo.aprovada is None


class TestRejeitar:
    def test_rejeita_e_notifica(self) -> None:
        repo = RepositorioFalso(existente=_candidatura())
        email_sender = EmailSenderFalso()
        resultado = CandidaturaVoluntariadoService(repo, email_sender).rejeitar("cand-1", "admin-9")

        assert resultado.status == "rejeitada"
        assert len(email_sender.enviados) == 1

    def test_candidatura_inexistente(self) -> None:
        repo = RepositorioFalso(existente=None)
        with pytest.raises(CandidaturaNaoEncontradaError):
            CandidaturaVoluntariadoService(repo, EmailSenderFalso()).rejeitar("cand-1", "admin-9")
