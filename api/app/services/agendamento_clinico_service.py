"""Regras do pedido de consulta clínica.

O que o utilizador podia mentir sobre isto, e é recusado aqui: pedir uma
consulta a uma clínica inexistente ou inactiva (`clinica_id` forjado) →
`ClinicaNaoEncontradaError`; um admin decidir um pedido que não existe, ou
já foi decidido → `AgendamentoNaoEncontradoError` / `AgendamentoJaDecididoError`.

O email ao paciente e à clínica é best-effort -- uma falha do Resend não
desfaz o pedido já gravado (mesmo desenho de `CandidaturaVoluntariadoService`):
a candidatura/pedido em si já é o estado de valor; perder essa gravação por
causa de um envio de email seria pior para quem precisa de ser visto.
"""

import logging
from datetime import UTC, datetime, timedelta

from app.core.email import EmailEnvioFalhouError, EmailSender
from app.repositories.agendamento_clinico_repository import (
    AgendamentoClinicoRegisto,
    AgendamentoClinicoRepository,
)
from app.repositories.clinica_parceira_repository import ClinicaParceiraRepository
from app.repositories.disponibilidade_clinica_repository import DisponibilidadeClinicaRepository
from app.schemas.agendamento import HorarioDisponivel

logger = logging.getLogger(__name__)

# Consultas de rastreio ocular não precisam de mais do que isto -- um
# calendário com duração configurável por clínica seria over-engineering
# nesta fase (ver docs/BACKLOG.md, Sprint 4, "Riscos a não ignorar").
DURACAO_SLOT_MINUTOS = 30

# Nenhum horário a menos deste aviso mínimo -- evita marcar uma consulta
# daqui a 2 minutos que a clínica nunca vai conseguir honrar.
ANTECEDENCIA_MINIMA = timedelta(hours=2)

# Não gerar uma lista infinita de horários -- 14 dias é suficiente para
# reservar sem forçar a clínica a planear meses à frente.
DIAS_A_GERAR = 14


class ClinicaNaoEncontradaError(Exception):
    pass


class AgendamentoNaoEncontradoError(Exception):
    pass


class AgendamentoJaDecididoError(Exception):
    pass


class HorarioIndisponivelError(Exception):
    """O horário pedido já não está livre, é no passado, ou não corresponde
    a nenhuma janela de disponibilidade real da clínica -- nunca se confia
    num horário vindo do browser sem o revalidar aqui."""



class AgendamentoClinicoService:
    def __init__(
        self,
        agendamentos: AgendamentoClinicoRepository,
        clinicas: ClinicaParceiraRepository,
        disponibilidades: DisponibilidadeClinicaRepository,
        email_sender: EmailSender,
    ) -> None:
        self._agendamentos = agendamentos
        self._clinicas = clinicas
        self._disponibilidades = disponibilidades
        self._email = email_sender

    def horarios_disponiveis(self, clinica_id: str, modalidade: str) -> list[HorarioDisponivel]:
        clinica = self._clinicas.obter(clinica_id)
        if clinica is None or not clinica.ativa:
            raise ClinicaNaoEncontradaError(clinica_id)

        janelas = [j for j in self._disponibilidades.listar_por_clinica(clinica_id) if j.modalidade == modalidade]
        agora = datetime.now(UTC)
        limite_inferior = agora + ANTECEDENCIA_MINIMA
        duracao = timedelta(minutes=DURACAO_SLOT_MINUTOS)
        resultado: list[HorarioDisponivel] = []

        for i in range(DIAS_A_GERAR):
            dia = (agora + timedelta(days=i)).date()
            for janela in janelas:
                if janela.dia_semana != dia.weekday():
                    continue
                cursor = datetime.combine(dia, janela.hora_inicio, tzinfo=UTC)
                fim_janela = datetime.combine(dia, janela.hora_fim, tzinfo=UTC)
                while cursor + duracao <= fim_janela:
                    if cursor >= limite_inferior and not self._agendamentos.existe_conflito(clinica_id, cursor):
                        resultado.append(HorarioDisponivel(inicio=cursor, fim=cursor + duracao))
                    cursor += duracao

        resultado.sort(key=lambda h: h.inicio)
        return resultado

    def _horario_e_valido(self, clinica_id: str, modalidade: str, horario_inicio: datetime) -> bool:
        janelas = [j for j in self._disponibilidades.listar_por_clinica(clinica_id) if j.modalidade == modalidade]
        for janela in janelas:
            if janela.dia_semana != horario_inicio.weekday():
                continue
            inicio_janela = horario_inicio.replace(
                hour=janela.hora_inicio.hour, minute=janela.hora_inicio.minute, second=0, microsecond=0
            )
            fim_janela = horario_inicio.replace(
                hour=janela.hora_fim.hour, minute=janela.hora_fim.minute, second=0, microsecond=0
            )
            if inicio_janela <= horario_inicio < fim_janela:
                return True
        return False

    def pedir(
        self,
        clinica_id: str,
        nome: str,
        email: str,
        telefone: str,
        modalidade: str,
        horario_inicio: datetime,
        motivo: str | None,
        utilizador_id: str | None,
        screening_id: str | None,
    ) -> AgendamentoClinicoRegisto:
        clinica = self._clinicas.obter(clinica_id)
        if clinica is None or not clinica.ativa:
            raise ClinicaNaoEncontradaError(clinica_id)

        agora = datetime.now(UTC)
        if horario_inicio < agora + ANTECEDENCIA_MINIMA:
            raise HorarioIndisponivelError(horario_inicio)
        if self._agendamentos.existe_conflito(clinica_id, horario_inicio):
            raise HorarioIndisponivelError(horario_inicio)
        if not self._horario_e_valido(clinica_id, modalidade, horario_inicio):
            raise HorarioIndisponivelError(horario_inicio)

        agendamento = self._agendamentos.criar(
            clinica_id=clinica_id,
            utilizador_id=utilizador_id,
            screening_id=screening_id,
            nome=nome,
            email=email,
            telefone=telefone,
            modalidade=modalidade,
            horario_inicio=horario_inicio,
            motivo=motivo,
        )

        self._enviar_email_best_effort(
            email,
            f"Pedido de consulta recebido — {clinica.nome}",
            f"<p>Recebemos o seu pedido de consulta {modalidade} com {clinica.nome}. "
            "A clínica vai avaliar a disponibilidade e entrará em contacto consigo em breve.</p>",
        )
        self._enviar_email_best_effort(
            clinica.email_contacto,
            "Novo pedido de consulta — Janelas Para a Alma",
            f"<p>{nome} pediu uma consulta {modalidade} através da Janelas Para a Alma.</p>"
            f"<p>Contacto: {telefone} / {email}</p>"
            f"<p>Motivo: {motivo or '(não indicado)'}</p>",
        )
        return agendamento

    def confirmar(self, agendamento_id: str, admin_id: str) -> AgendamentoClinicoRegisto:
        agendamento = self._obter_pendente(agendamento_id)
        resultado = self._agendamentos.confirmar(agendamento_id, admin_id, datetime.now(UTC))

        self._enviar_email_best_effort(
            agendamento.email,
            "A sua consulta foi confirmada — Janelas Para a Alma",
            "<p>A sua consulta foi confirmada. A clínica vai entrar em contacto consigo "
            "para combinar os detalhes finais.</p>",
        )
        return resultado

    def recusar(self, agendamento_id: str, admin_id: str) -> AgendamentoClinicoRegisto:
        agendamento = self._obter_pendente(agendamento_id)
        resultado = self._agendamentos.recusar(agendamento_id, admin_id, datetime.now(UTC))

        self._enviar_email_best_effort(
            agendamento.email,
            "O seu pedido de consulta — Janelas Para a Alma",
            "<p>Neste momento não foi possível confirmar a sua consulta nesta modalidade/data. "
            "Entre em contacto directamente com a clínica para outras opções.</p>",
        )
        return resultado

    def _obter_pendente(self, agendamento_id: str) -> AgendamentoClinicoRegisto:
        agendamento = self._agendamentos.obter(agendamento_id)
        if agendamento is None:
            raise AgendamentoNaoEncontradoError(agendamento_id)
        if agendamento.estado != "pendente":
            raise AgendamentoJaDecididoError(agendamento_id)
        return agendamento

    def _enviar_email_best_effort(self, destinatario: str, assunto: str, corpo_html: str) -> None:
        try:
            self._email.enviar(destinatario=destinatario, assunto=assunto, corpo_html=corpo_html)
        except EmailEnvioFalhouError:
            logger.warning("falha ao enviar email de agendamento clínico para %s", destinatario)
