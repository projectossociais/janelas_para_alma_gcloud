"""Testes do `AgendamentoClinicoService`.

Mesmo desenho do `CandidaturaVoluntariadoService`: uma falha no envio do
email não desfaz o pedido já gravado.
"""

from datetime import UTC, datetime, time

import pytest

from app.core.email import EmailEnvioFalhouError
from app.repositories.agendamento_clinico_repository import AgendamentoClinicoRegisto
from app.repositories.clinica_parceira_repository import ClinicaParceiraRegisto
from app.repositories.disponibilidade_clinica_repository import DisponibilidadeRegisto
from app.services.agendamento_clinico_service import (
    AgendamentoClinicoService,
    AgendamentoJaDecididoError,
    AgendamentoNaoEncontradoError,
    ClinicaNaoEncontradaError,
    HorarioIndisponivelError,
)

# 2027-01-04 é uma segunda-feira (weekday() == 0) -- longe o suficiente no
# futuro para nunca cair dentro de ANTECEDENCIA_MINIMA em nenhum ambiente de CI.
HORARIO_VALIDO = datetime(2027, 1, 4, 9, 0, tzinfo=UTC)


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
        "periodo_preferido": None,
        "horario_inicio": HORARIO_VALIDO,
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
        "especialidades": [],
        "cidade": "Luanda",
        "modalidades_suportadas": ["presencial", "online"],
        "preco_indicativo": None,
        "created_at": datetime.now(UTC),
    }
    base.update(over)
    return ClinicaParceiraRegisto(**base)


def _disponibilidade(**over) -> DisponibilidadeRegisto:
    base = {
        "id": "disp-1",
        "clinica_id": "clinica-1",
        "dia_semana": 0,
        "hora_inicio": time(8, 0),
        "hora_fim": time(12, 0),
        "modalidade": "presencial",
        "created_at": datetime.now(UTC),
    }
    base.update(over)
    return DisponibilidadeRegisto(**base)


class RepositorioAgendamentosFalso:
    def __init__(self, existente: AgendamentoClinicoRegisto | None = None, conflito: bool = False) -> None:
        self._existente = existente
        self._conflito = conflito
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

    def existe_conflito(self, clinica_id: str, horario_inicio: datetime) -> bool:
        return self._conflito

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


class RepositorioDisponibilidadesFalso:
    def __init__(self, janelas: list[DisponibilidadeRegisto] | None = None) -> None:
        self._janelas = janelas if janelas is not None else [_disponibilidade()]

    def criar(self, **kwargs) -> DisponibilidadeRegisto:  # pragma: no cover
        raise NotImplementedError

    def listar_por_clinica(self, clinica_id: str) -> list[DisponibilidadeRegisto]:
        return [j for j in self._janelas if j.clinica_id == clinica_id]

    def remover(self, disponibilidade_id: str, clinica_id: str) -> bool:  # pragma: no cover
        raise NotImplementedError


class RepositorioTeleconsultasFalso:
    def __init__(self) -> None:
        self.criadas: list[dict] = []

    def criar(self, agendamento_id: str, sala_video: str):
        registo = {"agendamento_id": agendamento_id, "sala_video": sala_video}
        self.criadas.append(registo)
        return registo

    def obter_por_agendamento(self, agendamento_id: str):  # pragma: no cover
        raise NotImplementedError

    def iniciar(self, teleconsulta_id: str, quando):  # pragma: no cover
        raise NotImplementedError

    def concluir(self, teleconsulta_id: str, quando, recomendacao_clinica: str):  # pragma: no cover
        raise NotImplementedError


class EmailSenderFalso:
    def __init__(self, falha: bool = False) -> None:
        self.enviados: list[dict] = []
        self._falha = falha

    def enviar(self, destinatario: str, assunto: str, corpo_html: str) -> None:
        if self._falha:
            raise EmailEnvioFalhouError("falha simulada do Resend")
        self.enviados.append({"destinatario": destinatario, "assunto": assunto, "corpo_html": corpo_html})


def _servico(
    agendamentos: RepositorioAgendamentosFalso | None = None,
    clinicas: RepositorioClinicasFalso | None = None,
    disponibilidades: RepositorioDisponibilidadesFalso | None = None,
    teleconsultas: RepositorioTeleconsultasFalso | None = None,
    email_sender: EmailSenderFalso | None = None,
) -> AgendamentoClinicoService:
    return AgendamentoClinicoService(
        agendamentos or RepositorioAgendamentosFalso(),
        clinicas or RepositorioClinicasFalso(_clinica()),
        disponibilidades or RepositorioDisponibilidadesFalso(),
        teleconsultas or RepositorioTeleconsultasFalso(),
        email_sender or EmailSenderFalso(),
    )


DADOS_PEDIDO = {
    "clinica_id": "clinica-1",
    "nome": "Ana Silva",
    "email": "ana@example.com",
    "telefone": "+244900000000",
    "modalidade": "presencial",
    "horario_inicio": HORARIO_VALIDO,
    "motivo": "Visão turva",
    "utilizador_id": None,
    "screening_id": None,
}


class TestPedir:
    def test_cria_pedido_pendente(self) -> None:
        agendamentos = RepositorioAgendamentosFalso()
        resultado = _servico(agendamentos=agendamentos).pedir(**DADOS_PEDIDO)
        assert resultado.estado == "pendente"
        assert agendamentos.criado["nome"] == "Ana Silva"
        assert agendamentos.criado["horario_inicio"] == HORARIO_VALIDO

    def test_recusa_clinica_inexistente(self) -> None:
        agendamentos = RepositorioAgendamentosFalso()
        with pytest.raises(ClinicaNaoEncontradaError):
            _servico(agendamentos=agendamentos, clinicas=RepositorioClinicasFalso(None)).pedir(**DADOS_PEDIDO)
        assert agendamentos.criado is None

    def test_recusa_clinica_inativa(self) -> None:
        with pytest.raises(ClinicaNaoEncontradaError):
            _servico(clinicas=RepositorioClinicasFalso(_clinica(ativa=False))).pedir(**DADOS_PEDIDO)

    def test_recusa_horario_no_passado(self) -> None:
        agendamentos = RepositorioAgendamentosFalso()
        dados = {**DADOS_PEDIDO, "horario_inicio": datetime(2020, 1, 1, 9, 0, tzinfo=UTC)}
        with pytest.raises(HorarioIndisponivelError):
            _servico(agendamentos=agendamentos).pedir(**dados)
        assert agendamentos.criado is None

    def test_recusa_horario_ja_ocupado(self) -> None:
        agendamentos = RepositorioAgendamentosFalso(conflito=True)
        with pytest.raises(HorarioIndisponivelError):
            _servico(agendamentos=agendamentos).pedir(**DADOS_PEDIDO)
        assert agendamentos.criado is None

    def test_recusa_horario_fora_de_qualquer_disponibilidade(self) -> None:
        agendamentos = RepositorioAgendamentosFalso()
        disponibilidades = RepositorioDisponibilidadesFalso(janelas=[])
        with pytest.raises(HorarioIndisponivelError):
            _servico(agendamentos=agendamentos, disponibilidades=disponibilidades).pedir(**DADOS_PEDIDO)
        assert agendamentos.criado is None

    def test_recusa_horario_em_modalidade_diferente_da_disponivel(self) -> None:
        agendamentos = RepositorioAgendamentosFalso()
        disponibilidades = RepositorioDisponibilidadesFalso(janelas=[_disponibilidade(modalidade="online")])
        with pytest.raises(HorarioIndisponivelError):
            _servico(agendamentos=agendamentos, disponibilidades=disponibilidades).pedir(**DADOS_PEDIDO)

    def test_envia_email_ao_paciente_e_a_clinica(self) -> None:
        email_sender = EmailSenderFalso()
        _servico(email_sender=email_sender).pedir(**DADOS_PEDIDO)

        destinatarios = {e["destinatario"] for e in email_sender.enviados}
        assert destinatarios == {"ana@example.com", "geral@optioptika.com"}

    def test_falha_no_email_nao_impede_o_pedido(self) -> None:
        resultado = _servico(email_sender=EmailSenderFalso(falha=True)).pedir(**DADOS_PEDIDO)
        assert resultado.estado == "pendente"


class TestHorariosDisponiveis:
    def test_gera_horarios_dentro_da_janela_semanal(self) -> None:
        disponibilidades = RepositorioDisponibilidadesFalso(
            janelas=[_disponibilidade(dia_semana=0, hora_inicio=time(8, 0), hora_fim=time(9, 0))]
        )
        resultado = _servico(disponibilidades=disponibilidades).horarios_disponiveis("clinica-1", "presencial")

        assert len(resultado) > 0
        assert all(h.inicio.weekday() == 0 for h in resultado)
        assert all(time(8, 0) <= h.inicio.time() < time(9, 0) for h in resultado)

    def test_exclui_horario_ja_ocupado(self) -> None:
        agendamentos = RepositorioAgendamentosFalso(conflito=True)
        disponibilidades = RepositorioDisponibilidadesFalso(
            janelas=[_disponibilidade(dia_semana=0, hora_inicio=time(8, 0), hora_fim=time(9, 0))]
        )
        resultado = _servico(agendamentos=agendamentos, disponibilidades=disponibilidades).horarios_disponiveis(
            "clinica-1", "presencial"
        )
        assert resultado == []

    def test_ignora_janelas_de_outra_modalidade(self) -> None:
        disponibilidades = RepositorioDisponibilidadesFalso(janelas=[_disponibilidade(modalidade="online")])
        resultado = _servico(disponibilidades=disponibilidades).horarios_disponiveis("clinica-1", "presencial")
        assert resultado == []

    def test_recusa_clinica_inexistente(self) -> None:
        with pytest.raises(ClinicaNaoEncontradaError):
            _servico(clinicas=RepositorioClinicasFalso(None)).horarios_disponiveis("clinica-1", "presencial")


class TestConfirmarERecusar:
    def test_confirma_e_notifica_o_paciente(self) -> None:
        agendamentos = RepositorioAgendamentosFalso(existente=_agendamento())
        email_sender = EmailSenderFalso()
        resultado = _servico(agendamentos=agendamentos, email_sender=email_sender).confirmar("ag-1", "admin-9")

        assert resultado.estado == "confirmada"
        assert agendamentos.confirmado["admin_id"] == "admin-9"
        assert len(email_sender.enviados) == 1
        assert email_sender.enviados[0]["destinatario"] == "ana@example.com"

    def test_confirmar_consulta_online_cria_teleconsulta_e_inclui_o_link_no_email(self) -> None:
        agendamentos = RepositorioAgendamentosFalso(existente=_agendamento(modalidade="online"))
        teleconsultas = RepositorioTeleconsultasFalso()
        email_sender = EmailSenderFalso()
        _servico(agendamentos=agendamentos, teleconsultas=teleconsultas, email_sender=email_sender).confirmar(
            "ag-1", "admin-9"
        )

        assert len(teleconsultas.criadas) == 1
        assert teleconsultas.criadas[0]["agendamento_id"] == "ag-1"
        assert "meet.jit.si" in email_sender.enviados[0]["corpo_html"]

    def test_confirmar_consulta_presencial_nunca_cria_teleconsulta(self) -> None:
        agendamentos = RepositorioAgendamentosFalso(existente=_agendamento(modalidade="presencial"))
        teleconsultas = RepositorioTeleconsultasFalso()
        _servico(agendamentos=agendamentos, teleconsultas=teleconsultas).confirmar("ag-1", "admin-9")

        assert teleconsultas.criadas == []

    def test_recusa_e_notifica_o_paciente(self) -> None:
        agendamentos = RepositorioAgendamentosFalso(existente=_agendamento())
        email_sender = EmailSenderFalso()
        resultado = _servico(agendamentos=agendamentos, email_sender=email_sender).recusar("ag-1", "admin-9")

        assert resultado.estado == "recusada"
        assert len(email_sender.enviados) == 1

    def test_agendamento_inexistente(self) -> None:
        with pytest.raises(AgendamentoNaoEncontradoError):
            _servico().confirmar("nao-existe", "admin-9")

    def test_agendamento_ja_decidido(self) -> None:
        agendamentos = RepositorioAgendamentosFalso(existente=_agendamento(estado="confirmada"))
        with pytest.raises(AgendamentoJaDecididoError):
            _servico(agendamentos=agendamentos).confirmar("ag-1", "admin-9")
