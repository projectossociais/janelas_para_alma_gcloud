"""Regras do ciclo de vida da teleconsulta: agendada -> em_curso -> concluida.

O que o utilizador podia mentir sobre isto, e é recusado aqui: uma clínica
tentar iniciar/concluir a teleconsulta de um pedido que não é seu (id
adivinhado) -> `AcessoNegadoError`; avançar o estado fora de ordem (concluir
sem ter iniciado, iniciar duas vezes) -> `TeleconsultaEstadoInvalidoError`.

O email da recomendação clínica ao paciente é best-effort -- mesmo desenho
de `AgendamentoClinicoService`: uma falha do Resend não apaga o trabalho
clínico já registado.
"""

import logging
from datetime import UTC, datetime

from app.core.email import EmailEnvioFalhouError, EmailSender
from app.repositories.agendamento_clinico_repository import AgendamentoClinicoRepository
from app.repositories.teleconsulta_repository import TeleconsultaRegisto, TeleconsultaRepository

logger = logging.getLogger(__name__)


class AgendamentoNaoEncontradoError(Exception):
    pass


class AcessoNegadoError(Exception):
    """A clínica autenticada não é a dona deste pedido de consulta."""



class TeleconsultaNaoEncontradaError(Exception):
    """O pedido existe, mas não é uma consulta online confirmada -- nunca
    há teleconsulta para presencial nem para um pedido ainda pendente."""



class TeleconsultaEstadoInvalidoError(Exception):
    pass


class TeleconsultaService:
    def __init__(
        self,
        teleconsultas: TeleconsultaRepository,
        agendamentos: AgendamentoClinicoRepository,
        email_sender: EmailSender,
    ) -> None:
        self._teleconsultas = teleconsultas
        self._agendamentos = agendamentos
        self._email = email_sender

    def _obter_teleconsulta_da_clinica(self, agendamento_id: str, clinica_id: str) -> TeleconsultaRegisto:
        agendamento = self._agendamentos.obter(agendamento_id)
        if agendamento is None:
            raise AgendamentoNaoEncontradoError(agendamento_id)
        if agendamento.clinica_id != clinica_id:
            raise AcessoNegadoError(agendamento_id)
        teleconsulta = self._teleconsultas.obter_por_agendamento(agendamento_id)
        if teleconsulta is None:
            raise TeleconsultaNaoEncontradaError(agendamento_id)
        return teleconsulta

    def obter(self, agendamento_id: str, clinica_id: str) -> TeleconsultaRegisto:
        return self._obter_teleconsulta_da_clinica(agendamento_id, clinica_id)

    def iniciar(self, agendamento_id: str, clinica_id: str) -> TeleconsultaRegisto:
        teleconsulta = self._obter_teleconsulta_da_clinica(agendamento_id, clinica_id)
        if teleconsulta.estado != "agendada":
            raise TeleconsultaEstadoInvalidoError(teleconsulta.estado)
        return self._teleconsultas.iniciar(teleconsulta.id, datetime.now(UTC))

    def concluir(self, agendamento_id: str, clinica_id: str, recomendacao_clinica: str) -> TeleconsultaRegisto:
        teleconsulta = self._obter_teleconsulta_da_clinica(agendamento_id, clinica_id)
        if teleconsulta.estado != "em_curso":
            raise TeleconsultaEstadoInvalidoError(teleconsulta.estado)
        resultado = self._teleconsultas.concluir(teleconsulta.id, datetime.now(UTC), recomendacao_clinica)

        agendamento = self._agendamentos.obter(agendamento_id)
        if agendamento is not None:
            try:
                self._email.enviar(
                    destinatario=agendamento.email,
                    assunto="Recomendação da sua teleconsulta — Janelas Para a Alma",
                    corpo_html=(
                        f"<p>Obrigado por participar na sua teleconsulta. "
                        f"Recomendação da equipa clínica:</p><p>{recomendacao_clinica}</p>"
                    ),
                )
            except EmailEnvioFalhouError:
                logger.warning("falha ao enviar recomendação clínica para %s", agendamento.email)
        return resultado
