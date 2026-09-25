"""Testes do `TeleconsultaService` -- ciclo de vida da consulta online."""

from datetime import UTC, datetime

import pytest

from app.core.email import EmailEnvioFalhouError
from app.repositories.agendamento_clinico_repository import AgendamentoClinicoRegisto
from app.repositories.teleconsulta_repository import TeleconsultaRegisto
from app.services.teleconsulta_service import (
    AcessoNegadoError,
    AgendamentoNaoEncontradoError,
    TeleconsultaEstadoInvalidoError,
    TeleconsultaNaoEncontradaError,
    TeleconsultaService,
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
        "modalidade": "online",
        "data_preferida": None,
        "periodo_preferido": None,
        "horario_inicio": datetime(2027, 1, 4, 9, 0, tzinfo=UTC),
        "motivo": None,
        "estado": "confirmada",
        "decidido_por": "admin-1",
        "decidido_em": datetime.now(UTC),
        "created_at": datetime.now(UTC),
    }
    base.update(over)
    return AgendamentoClinicoRegisto(**base)


def _teleconsulta(**over) -> TeleconsultaRegisto:
    base = {
        "id": "tele-1",
        "agendamento_id": "ag-1",
        "sala_video": "janelas-para-alma-abc123",
        "estado": "agendada",
        "iniciada_em": None,
        "concluida_em": None,
        "recomendacao_clinica": None,
        "created_at": datetime.now(UTC),
    }
    base.update(over)
    return TeleconsultaRegisto(**base)


class RepositorioAgendamentosFalso:
    def __init__(self, agendamento: AgendamentoClinicoRegisto | None) -> None:
        self._agendamento = agendamento

    def obter(self, agendamento_id: str):
        return self._agendamento if self._agendamento and self._agendamento.id == agendamento_id else None


class RepositorioTeleconsultasFalso:
    def __init__(self, teleconsulta: TeleconsultaRegisto | None) -> None:
        self._teleconsulta = teleconsulta
        self.iniciada: dict | None = None
        self.concluida: dict | None = None

    def criar(self, agendamento_id: str, sala_video: str):  # pragma: no cover
        raise NotImplementedError

    def obter_por_agendamento(self, agendamento_id: str):
        if self._teleconsulta and self._teleconsulta.agendamento_id == agendamento_id:
            return self._teleconsulta
        return None

    def iniciar(self, teleconsulta_id: str, quando):
        self.iniciada = {"teleconsulta_id": teleconsulta_id, "quando": quando}
        return _teleconsulta(id=teleconsulta_id, estado="em_curso", iniciada_em=quando)

    def concluir(self, teleconsulta_id: str, quando, recomendacao_clinica: str):
        self.concluida = {"teleconsulta_id": teleconsulta_id, "quando": quando, "recomendacao": recomendacao_clinica}
        return _teleconsulta(
            id=teleconsulta_id, estado="concluida", concluida_em=quando, recomendacao_clinica=recomendacao_clinica
        )


class EmailSenderFalso:
    def __init__(self, falha: bool = False) -> None:
        self.enviados: list[dict] = []
        self._falha = falha

    def enviar(self, destinatario: str, assunto: str, corpo_html: str) -> None:
        if self._falha:
            raise EmailEnvioFalhouError("falha simulada")
        self.enviados.append({"destinatario": destinatario, "assunto": assunto, "corpo_html": corpo_html})


_SEM_OVERRIDE = object()


def _servico(agendamento=_SEM_OVERRIDE, teleconsulta=_SEM_OVERRIDE, email_sender=None) -> TeleconsultaService:
    agendamento_real = _agendamento() if agendamento is _SEM_OVERRIDE else agendamento
    teleconsulta_real = _teleconsulta() if teleconsulta is _SEM_OVERRIDE else teleconsulta
    return TeleconsultaService(
        RepositorioTeleconsultasFalso(teleconsulta_real),
        RepositorioAgendamentosFalso(agendamento_real),
        email_sender or EmailSenderFalso(),
    )


class TestObter:
    def test_devolve_a_teleconsulta_da_propria_clinica(self) -> None:
        resultado = _servico().obter("ag-1", "clinica-1")
        assert resultado.estado == "agendada"

    def test_recusa_agendamento_inexistente(self) -> None:
        with pytest.raises(AgendamentoNaoEncontradoError):
            _servico(agendamento=None).obter("nao-existe", "clinica-1")

    def test_recusa_clinica_que_nao_e_dona_do_pedido(self) -> None:
        with pytest.raises(AcessoNegadoError):
            _servico().obter("ag-1", "outra-clinica")

    def test_recusa_agendamento_sem_teleconsulta(self) -> None:
        with pytest.raises(TeleconsultaNaoEncontradaError):
            _servico(teleconsulta=None).obter("ag-1", "clinica-1")


class TestIniciar:
    def test_avanca_de_agendada_para_em_curso(self) -> None:
        teleconsultas = RepositorioTeleconsultasFalso(_teleconsulta())
        servico = TeleconsultaService(teleconsultas, RepositorioAgendamentosFalso(_agendamento()), EmailSenderFalso())

        resultado = servico.iniciar("ag-1", "clinica-1")

        assert resultado.estado == "em_curso"
        assert teleconsultas.iniciada["teleconsulta_id"] == "tele-1"

    def test_recusa_se_ja_nao_esta_agendada(self) -> None:
        with pytest.raises(TeleconsultaEstadoInvalidoError):
            _servico(teleconsulta=_teleconsulta(estado="em_curso")).iniciar("ag-1", "clinica-1")

    def test_recusa_clinica_que_nao_e_dona_do_pedido(self) -> None:
        with pytest.raises(AcessoNegadoError):
            _servico().iniciar("ag-1", "outra-clinica")


class TestConcluir:
    def test_avanca_de_em_curso_para_concluida_e_grava_recomendacao(self) -> None:
        teleconsultas = RepositorioTeleconsultasFalso(_teleconsulta(estado="em_curso"))
        email_sender = EmailSenderFalso()
        servico = TeleconsultaService(
            teleconsultas, RepositorioAgendamentosFalso(_agendamento()), email_sender
        )

        resultado = servico.concluir("ag-1", "clinica-1", "Usar óculos com grau X.")

        assert resultado.estado == "concluida"
        assert resultado.recomendacao_clinica == "Usar óculos com grau X."
        assert teleconsultas.concluida["recomendacao"] == "Usar óculos com grau X."

    def test_envia_a_recomendacao_ao_paciente_por_email(self) -> None:
        email_sender = EmailSenderFalso()
        _servico(teleconsulta=_teleconsulta(estado="em_curso"), email_sender=email_sender).concluir(
            "ag-1", "clinica-1", "Usar óculos com grau X."
        )

        assert len(email_sender.enviados) == 1
        assert email_sender.enviados[0]["destinatario"] == "ana@example.com"
        assert "Usar óculos com grau X." in email_sender.enviados[0]["corpo_html"]

    def test_falha_no_email_nao_impede_a_conclusao(self) -> None:
        resultado = _servico(
            teleconsulta=_teleconsulta(estado="em_curso"), email_sender=EmailSenderFalso(falha=True)
        ).concluir("ag-1", "clinica-1", "Usar óculos.")
        assert resultado.estado == "concluida"

    def test_recusa_se_ainda_nao_foi_iniciada(self) -> None:
        with pytest.raises(TeleconsultaEstadoInvalidoError):
            _servico(teleconsulta=_teleconsulta(estado="agendada")).concluir("ag-1", "clinica-1", "Usar óculos.")

    def test_recusa_se_ja_esta_concluida(self) -> None:
        with pytest.raises(TeleconsultaEstadoInvalidoError):
            _servico(teleconsulta=_teleconsulta(estado="concluida")).concluir("ag-1", "clinica-1", "Usar óculos.")

    def test_recusa_clinica_que_nao_e_dona_do_pedido(self) -> None:
        with pytest.raises(AcessoNegadoError):
            _servico(teleconsulta=_teleconsulta(estado="em_curso")).concluir("ag-1", "outra-clinica", "Usar óculos.")
