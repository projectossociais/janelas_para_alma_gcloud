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
from datetime import UTC, date, datetime

from app.core.email import EmailEnvioFalhouError, EmailSender
from app.repositories.agendamento_clinico_repository import (
    AgendamentoClinicoRegisto,
    AgendamentoClinicoRepository,
)
from app.repositories.clinica_parceira_repository import ClinicaParceiraRepository

logger = logging.getLogger(__name__)


class ClinicaNaoEncontradaError(Exception):
    pass


class AgendamentoNaoEncontradoError(Exception):
    pass


class AgendamentoJaDecididoError(Exception):
    pass


class AgendamentoClinicoService:
    def __init__(
        self,
        agendamentos: AgendamentoClinicoRepository,
        clinicas: ClinicaParceiraRepository,
        email_sender: EmailSender,
    ) -> None:
        self._agendamentos = agendamentos
        self._clinicas = clinicas
        self._email = email_sender

    def pedir(
        self,
        clinica_id: str,
        nome: str,
        email: str,
        telefone: str,
        modalidade: str,
        data_preferida: date | None,
        periodo_preferido: str | None,
        motivo: str | None,
        utilizador_id: str | None,
        screening_id: str | None,
    ) -> AgendamentoClinicoRegisto:
        clinica = self._clinicas.obter(clinica_id)
        if clinica is None or not clinica.ativa:
            raise ClinicaNaoEncontradaError(clinica_id)

        agendamento = self._agendamentos.criar(
            clinica_id=clinica_id,
            utilizador_id=utilizador_id,
            screening_id=screening_id,
            nome=nome,
            email=email,
            telefone=telefone,
            modalidade=modalidade,
            data_preferida=data_preferida,
            periodo_preferido=periodo_preferido,
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
