"""Testes do `AgendamentoClinicoService`.

Mesmo desenho do `CandidaturaVoluntariadoService`: uma falha no envio do
email não desfaz o pedido já gravado.
"""

from datetime import UTC, datetime

import pytest

from app.core.email import EmailEnvioFalhouError
from app.repositories.agendamento_clinico_repository import AgendamentoClinicoRegisto
from app.repositories.clinica_parceira_repository import ClinicaParceiraRegisto
from app.services.agendamento_clinico_service import (
    AgendamentoClinicoService,
    AgendamentoJaDecididoError,
    AgendamentoNaoEncontradoError,
    ClinicaNaoEncontradaError,
)


def _agendamento(**over) -> AgendamentoClinicoRegisto:
    base = {
        "id": "ag-1",
        "clinica_id": "clinica-1",
        "utilizador_id": None,
        "screening_id": None,
        "nome": "Ana Silva",
        "email": "ana@example.com",
        "telefone": "+244900000000",
        "modalidade": "presencial",
        "data_preferida": None,
        "periodo_preferido": "manha",
        "motivo": "Visão turva",
        "estado": "pendente",
        "decidido_por": None,
        "decidido_em": None,
        "created_at": datetime.now(UTC),
    }
    base.update(over)
    return AgendamentoClinicoRegisto(**base)


def _clinica(**over) -> ClinicaParceiraRegisto:
    base = {
        "id": "clinica-1",
        "nome": "Óptica Optioptika",
        "email_contacto": "geral@optioptika.com",
        "telefone_contacto": "+244931240304",
        "ativa": True,
        "created_at": datetime.now(UTC),
    }
    base.update(over)
    return ClinicaParceiraRegisto(**base)


class RepositorioAgendamentosFalso:
    def __init__(self, existente: AgendamentoClinicoRegisto | None = None) -> None:
        self._existente = existente
        self.criado: dict | None = None
        self.confirmado: dict | None = None
        self.recusado: dict | None = None

    def criar(self, **kwargs) -> AgendamentoClinicoRegisto:
        self.criado = kwargs
        return _agendamento(**kwargs)

    def obter(self, agendamento_id: str) -> AgendamentoClinicoRegisto | None:
        return self._existente if self._existente and self._existente.id == agendamento_id else None

    def listar(self):  # pragma: no cover
        raise NotImplementedError

    def confirmar(self, agendamento_id, admin_id, quando) -> AgendamentoClinicoRegisto:
        self.confirmado = {"agendamento_id": agendamento_id, "admin_id": admin_id, "quando": quando}
        return _agendamento(estado="confirmada", decidido_por=admin_id, decidido_em=quando)

    def recusar(self, agendamento_id, admin_id, quando) -> AgendamentoClinicoRegisto:
        self.recusado = {"agendamento_id": agendamento_id, "admin_id": admin_id, "quando": quando}
        return _agendamento(estado="recusada", decidido_por=admin_id, decidido_em=quando)


class RepositorioClinicasFalso:
    def __init__(self, clinica: ClinicaParceiraRegisto | None) -> None:
        self._clinica = clinica

    def listar_ativas(self):  # pragma: no cover
        raise NotImplementedError

    def obter(self, clinica_id: str) -> ClinicaParceiraRegisto | None:
        return self._clinica if self._clinica and self._clinica.id == clinica_id else None


class EmailSenderFalso:
    def __init__(self, falha: bool = False) -> None:
        self.enviados: list[dict] = []
        self._falha = falha

    def enviar(self, destinatario: str, assunto: str, corpo_html: str) -> None:
        if self._falha:
            raise EmailEnvioFalhouError("falha simulada do Resend")
        self.enviados.append({"destinatario": destinatario, "assunto": assunto, "corpo_html": corpo_html})


DADOS_PEDIDO = {
    "clinica_id": "clinica-1",
    "nome": "Ana Silva",
    "email": "ana@example.com",
    "telefone": "+244900000000",
    "modalidade": "presencial",
    "data_preferida": None,
    "periodo_preferido": "manha",
    "motivo": "Visão turva",
    "utilizador_id": None,
    "screening_id": None,
}


class TestPedir:
    def test_cria_pedido_pendente(self) -> None:
        agendamentos = RepositorioAgendamentosFalso()
        clinicas = RepositorioClinicasFalso(_clinica())
        resultado = AgendamentoClinicoService(agendamentos, clinicas, EmailSenderFalso()).pedir(**DADOS_PEDIDO)
        assert resultado.estado == "pendente"
        assert agendamentos.criado["nome"] == "Ana Silva"

    def test_recusa_clinica_inexistente(self) -> None:
        agendamentos = RepositorioAgendamentosFalso()
        clinicas = RepositorioClinicasFalso(None)
        with pytest.raises(ClinicaNaoEncontradaError):
            AgendamentoClinicoService(agendamentos, clinicas, EmailSenderFalso()).pedir(**DADOS_PEDIDO)
        assert agendamentos.criado is None

    def test_recusa_clinica_inativa(self) -> None:
        agendamentos = RepositorioAgendamentosFalso()
        clinicas = RepositorioClinicasFalso(_clinica(ativa=False))
        with pytest.raises(ClinicaNaoEncontradaError):
            AgendamentoClinicoService(agendamentos, clinicas, EmailSenderFalso()).pedir(**DADOS_PEDIDO)

    def test_envia_email_ao_paciente_e_a_clinica(self) -> None:
        agendamentos = RepositorioAgendamentosFalso()
        clinicas = RepositorioClinicasFalso(_clinica())
        email_sender = EmailSenderFalso()
        AgendamentoClinicoService(agendamentos, clinicas, email_sender).pedir(**DADOS_PEDIDO)

        destinatarios = {e["destinatario"] for e in email_sender.enviados}
        assert destinatarios == {"ana@example.com", "geral@optioptika.com"}

    def test_falha_no_email_nao_impede_o_pedido(self) -> None:
        agendamentos = RepositorioAgendamentosFalso()
        clinicas = RepositorioClinicasFalso(_clinica())
        resultado = AgendamentoClinicoService(agendamentos, clinicas, EmailSenderFalso(falha=True)).pedir(
            **DADOS_PEDIDO
        )
        assert resultado.estado == "pendente"


class TestConfirmarERecusar:
    def test_confirma_e_notifica_o_paciente(self) -> None:
        agendamentos = RepositorioAgendamentosFalso(existente=_agendamento())
        clinicas = RepositorioClinicasFalso(_clinica())
        email_sender = EmailSenderFalso()
        resultado = AgendamentoClinicoService(agendamentos, clinicas, email_sender).confirmar("ag-1", "admin-9")

        assert resultado.estado == "confirmada"
        assert agendamentos.confirmado["admin_id"] == "admin-9"
        assert len(email_sender.enviados) == 1
        assert email_sender.enviados[0]["destinatario"] == "ana@example.com"

    def test_recusa_e_notifica_o_paciente(self) -> None:
        agendamentos = RepositorioAgendamentosFalso(existente=_agendamento())
        clinicas = RepositorioClinicasFalso(_clinica())
        email_sender = EmailSenderFalso()
        resultado = AgendamentoClinicoService(agendamentos, clinicas, email_sender).recusar("ag-1", "admin-9")

        assert resultado.estado == "recusada"
        assert len(email_sender.enviados) == 1

    def test_agendamento_inexistente(self) -> None:
        agendamentos = RepositorioAgendamentosFalso()
        clinicas = RepositorioClinicasFalso(_clinica())
        with pytest.raises(AgendamentoNaoEncontradoError):
            AgendamentoClinicoService(agendamentos, clinicas, EmailSenderFalso()).confirmar("nao-existe", "admin-9")

    def test_agendamento_ja_decidido(self) -> None:
        agendamentos = RepositorioAgendamentosFalso(existente=_agendamento(estado="confirmada"))
        clinicas = RepositorioClinicasFalso(_clinica())
        with pytest.raises(AgendamentoJaDecididoError):
            AgendamentoClinicoService(agendamentos, clinicas, EmailSenderFalso()).confirmar("ag-1", "admin-9")
