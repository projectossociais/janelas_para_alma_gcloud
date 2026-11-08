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
import secrets
from datetime import UTC, datetime, timedelta
from html import escape

from app.core.email import Anexo, EmailEnvioFalhouError, EmailSender
from app.core.feriados_angola import e_feriado
from app.core.fuso import FUSO_LUANDA
from app.repositories.agendamento_clinico_repository import (
    AgendamentoClinicoRegisto,
    AgendamentoClinicoRepository,
)
from app.repositories.clinica_parceira_repository import (
    ClinicaParceiraRegisto,
    ClinicaParceiraRepository,
)
from app.repositories.disponibilidade_clinica_repository import DisponibilidadeClinicaRepository
from app.repositories.teleconsulta_repository import TeleconsultaRepository
from app.schemas.agendamento import HorarioDisponivel
from app.services.ficha_encaminhamento import (
    FichaEncaminhamento,
    gerar_ficha_encaminhamento,
    referencia_do_agendamento,
)

logger = logging.getLogger(__name__)

# Uma consulta "online" confirmada ganha sempre uma sala Jitsi Meet
# (meet.jit.si, servidor público gratuito da 8x8) -- decisão do dono do
# projecto (2026-09-25): sem orçamento para Daily.co/100ms. Um link normal
# aberto numa aba nova, nunca embutido via IFrame API (que tem um limite de
# 5 minutos no modo embutido). Só o nome da sala é guardado, nunca o URL
# completo, para o domínio do fornecedor poder mudar sem migração de dados.
PREFIXO_SALA_VIDEO = "janelas-para-alma"
JITSI_BASE_URL = "https://meet.jit.si"

# Consultas de rastreio ocular não precisam de mais do que isto -- um
# calendário com duração configurável por clínica seria over-engineering
# nesta fase (ver docs/BACKLOG.md, Sprint 4, "Riscos a não ignorar").
DURACAO_SLOT_MINUTOS = 30

# Nenhum horário a menos deste aviso mínimo -- evita marcar uma consulta
# daqui a 2 minutos que a clínica nunca vai conseguir honrar.
ANTECEDENCIA_MINIMA = timedelta(hours=2)

# Cerca de três meses à frente: as famílias marcam com semanas de antecedência
# (pedido do dono do projecto, 2026-11-07: chegar até Janeiro). O browser
# escolhe primeiro o dia e só depois a hora, por isso a lista não pesa.
DIAS_A_GERAR = 90


# As janelas de disponibilidade são escritas pela clínica no portal em hora
# local (`<input type="time">`), por isso são horas de Luanda, nunca UTC.
# Bug real até 2026-09-30: eram tratadas como UTC e a família via tudo uma
# hora mais tarde do que a clínica tinha marcado.
DIAS_DA_SEMANA = ("segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado", "domingo")


def formatar_horario(momento: datetime) -> str:
    """"segunda-feira, 04/01/2027 às 10:00 (hora de Luanda)", para os emails."""
    local = momento.astimezone(FUSO_LUANDA)
    return f"{DIAS_DA_SEMANA[local.weekday()]}, {local:%d/%m/%Y} às {local:%H:%M} (hora de Luanda)"


def _com_fuso(momento: datetime) -> datetime:
    """Um instante sem fuso conta como UTC (em vez de rebentar ao comparar)."""
    return momento if momento.tzinfo is not None else momento.replace(tzinfo=UTC)


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
        teleconsultas: TeleconsultaRepository,
        email_sender: EmailSender,
    ) -> None:
        self._agendamentos = agendamentos
        self._clinicas = clinicas
        self._disponibilidades = disponibilidades
        self._teleconsultas = teleconsultas
        self._email = email_sender

    def horarios_disponiveis(self, clinica_id: str, modalidade: str) -> list[HorarioDisponivel]:
        clinica = self._clinicas.obter(clinica_id)
        if clinica is None or not clinica.ativa:
            raise ClinicaNaoEncontradaError(clinica_id)

        janelas = [j for j in self._disponibilidades.listar_por_clinica(clinica_id) if j.modalidade == modalidade]
        agora = datetime.now(UTC)
        limite_inferior = agora + ANTECEDENCIA_MINIMA
        duracao = timedelta(minutes=DURACAO_SLOT_MINUTOS)
        hoje_em_luanda = agora.astimezone(FUSO_LUANDA).date()
        resultado: list[HorarioDisponivel] = []

        inicio_periodo = datetime.combine(hoje_em_luanda, datetime.min.time(), tzinfo=FUSO_LUANDA)
        ocupados = {
            _com_fuso(h)
            for h in self._agendamentos.horarios_ocupados(
                clinica_id, inicio_periodo, inicio_periodo + timedelta(days=DIAS_A_GERAR + 1)
            )
        }

        for i in range(DIAS_A_GERAR):
            dia = hoje_em_luanda + timedelta(days=i)
            if e_feriado(dia):
                continue
            for janela in janelas:
                if janela.dia_semana != dia.weekday():
                    continue
                cursor = datetime.combine(dia, janela.hora_inicio, tzinfo=FUSO_LUANDA)
                fim_janela = datetime.combine(dia, janela.hora_fim, tzinfo=FUSO_LUANDA)
                while cursor + duracao <= fim_janela:
                    if cursor >= limite_inferior and cursor not in ocupados:
                        resultado.append(HorarioDisponivel(inicio=cursor, fim=cursor + duracao))
                    cursor += duracao

        resultado.sort(key=lambda h: h.inicio)
        return resultado

    def _horario_e_valido(self, clinica_id: str, modalidade: str, horario_inicio: datetime) -> bool:
        janelas = [j for j in self._disponibilidades.listar_por_clinica(clinica_id) if j.modalidade == modalidade]
        local = horario_inicio.astimezone(FUSO_LUANDA)
        if e_feriado(local.date()):
            return False
        for janela in janelas:
            if janela.dia_semana != local.weekday():
                continue
            inicio_janela = local.replace(
                hour=janela.hora_inicio.hour, minute=janela.hora_inicio.minute, second=0, microsecond=0
            )
            fim_janela = local.replace(
                hour=janela.hora_fim.hour, minute=janela.hora_fim.minute, second=0, microsecond=0
            )
            if inicio_janela <= local < fim_janela:
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

        horario_inicio = _com_fuso(horario_inicio)
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

        # Tudo o que o utilizador escreveu é escapado antes de entrar no HTML.
        quando = formatar_horario(horario_inicio)
        referencia = referencia_do_agendamento(agendamento.id)
        self._enviar_email_best_effort(
            email,
            f"Pedido de consulta recebido — {clinica.nome}",
            f"<p>Recebemos o seu pedido de consulta {modalidade} com {escape(clinica.nome)} "
            f"para {quando}.</p>"
            "<p>A clínica vai confirmar e entrará em contacto consigo em breve.</p>"
            f"<p>Referência do pedido: <strong>{referencia}</strong></p>",
        )
        self._enviar_email_best_effort(
            clinica.email_contacto,
            f"Novo pedido de consulta {referencia} — Janelas Para a Alma",
            f"<p>{escape(nome)} pediu uma consulta {modalidade} através da Janelas Para a Alma, "
            f"para {quando}.</p>"
            f"<p>Contacto: {escape(telefone)} / {escape(email)}</p>"
            f"<p>Motivo: {escape(motivo) if motivo else '(não indicado)'}</p>"
            f"<p>Em anexo segue a ficha de encaminhamento {referencia}, com todos os dados do pedido "
            "e os próximos passos. Contém dados pessoais e de saúde: trate-a como confidencial.</p>",
            anexos=self._ficha_em_anexo(clinica, agendamento, referencia, horario_inicio, screening_id),
        )
        return agendamento

    def _ficha_em_anexo(
        self,
        clinica: ClinicaParceiraRegisto,
        agendamento: AgendamentoClinicoRegisto,
        referencia: str,
        horario_inicio: datetime,
        screening_id: str | None,
    ) -> list[Anexo]:
        """A ficha em PDF é um extra: se falhar a gerar, a clínica recebe o
        email na mesma, sem anexo -- nunca se perde o pedido por causa disto."""
        try:
            pdf = gerar_ficha_encaminhamento(
                FichaEncaminhamento(
                    referencia=referencia,
                    emitida_em=datetime.now(UTC),
                    clinica_nome=clinica.nome,
                    clinica_email=clinica.email_contacto,
                    clinica_telefone=clinica.telefone_contacto,
                    clinica_cidade=clinica.cidade,
                    paciente_nome=agendamento.nome,
                    paciente_email=agendamento.email,
                    paciente_telefone=agendamento.telefone,
                    conta_registada=agendamento.utilizador_id is not None,
                    modalidade=agendamento.modalidade,
                    horario_inicio=horario_inicio,
                    duracao_minutos=DURACAO_SLOT_MINUTOS,
                    motivo=agendamento.motivo,
                    rastreio_associado=screening_id is not None,
                )
            )
        except Exception:
            logger.exception("falha ao gerar a ficha de encaminhamento %s", referencia)
            return []
        return [Anexo(nome_ficheiro=f"ficha-encaminhamento-{referencia}.pdf", conteudo=pdf)]

    def confirmar(self, agendamento_id: str, admin_id: str) -> AgendamentoClinicoRegisto:
        agendamento = self._obter_pendente(agendamento_id)
        resultado = self._agendamentos.confirmar(agendamento_id, admin_id, datetime.now(UTC))

        quando = formatar_horario(agendamento.horario_inicio) if agendamento.horario_inicio else None
        corpo = (
            f"<p>A sua consulta foi confirmada{f' para {quando}' if quando else ''}. "
            "A clínica vai entrar em contacto consigo para combinar os detalhes finais.</p>"
        )
        if agendamento.modalidade == "online":
            sala = f"{PREFIXO_SALA_VIDEO}-{secrets.token_hex(12)}"
            self._teleconsultas.criar(agendamento_id, sala)
            corpo += (
                f'<p>A sua consulta é por videochamada. Entre pela sala: '
                f'<a href="{JITSI_BASE_URL}/{sala}">{JITSI_BASE_URL}/{sala}</a> '
                "à hora combinada -- não precisa de instalar nada nem de criar conta.</p>"
            )

        self._enviar_email_best_effort(agendamento.email, "A sua consulta foi confirmada — Janelas Para a Alma", corpo)
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

    def _enviar_email_best_effort(
        self, destinatario: str, assunto: str, corpo_html: str, anexos: list[Anexo] | None = None
    ) -> None:
        try:
            if anexos:
                self._email.enviar(
                    destinatario=destinatario, assunto=assunto, corpo_html=corpo_html, anexos=anexos
                )
            else:
                self._email.enviar(destinatario=destinatario, assunto=assunto, corpo_html=corpo_html)
        except EmailEnvioFalhouError:
            logger.warning("falha ao enviar email de agendamento clínico para %s", destinatario)
