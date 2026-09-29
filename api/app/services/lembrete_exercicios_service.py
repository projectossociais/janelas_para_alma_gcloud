"""Lembrete diário de treino por email (Fase A, docs/ANALISE_EXERCICIOS.md).

A adesão pesa mais do que o algoritmo: o ensaio PEDIG com jogos binoculares
(Holmes, 2016) falhou sobretudo porque as crianças deixaram de treinar. Um
job diário (Cloud Scheduler -> `POST /interno/lembretes-exercicios`, mesmo
padrão do W-03) avisa quem ainda não treinou hoje.

Quem recebe (regra decidida aqui, aplicada pelo repository):
- activou "Lembretes de Exercícios Visuais" nas Configurações (opt-in: a
  coluna nasce `false`), confirmou o email e não tem a conta anonimizada;
- tem acesso aos treinos agora (Premium válido ou trial activo), e não é admin;
- treinou nos últimos 14 dias (mantém um hábito; não insiste com quem parou
  de vez) e ainda não treinou hoje, no dia de Luanda.

Uma falha de envio a uma pessoa nunca impede as outras; conta-se e segue.
O job deve correr sem novas tentativas automáticas (`--max-retry-attempts=0`):
repetir o pedido reenviaria a quem já recebeu.
"""

import html
import logging
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from app.core.config import obter_settings
from app.core.email import EmailEnvioFalhouError, EmailSender
from app.core.fuso import inicio_do_dia_em_luanda
from app.repositories.lembrete_exercicios_repository import LembreteExerciciosRepository
from app.services.acesso_exercicios_service import IDS_TREINOS

logger = logging.getLogger(__name__)

JANELA_HABITO_DIAS = 14
ASSUNTO = "Ainda não treinou hoje: bastam 6 minutos"


@dataclass(frozen=True)
class ResultadoLembretes:
    enviados: int
    falhados: int


class LembreteExerciciosService:
    def __init__(
        self,
        repositorio: LembreteExerciciosRepository,
        email_sender: EmailSender,
        relogio: Callable[[], datetime] = lambda: datetime.now(UTC),
    ) -> None:
        self._repo = repositorio
        self._email = email_sender
        self._relogio = relogio

    def enviar_lembretes(self) -> ResultadoLembretes:
        agora = self._relogio()
        inicio_hoje = inicio_do_dia_em_luanda(agora)
        destinatarios = self._repo.listar_destinatarios(
            agora=agora,
            inicio_hoje=inicio_hoje,
            treinou_desde=inicio_hoje - timedelta(days=JANELA_HABITO_DIAS),
            ids_treinos=IDS_TREINOS,
        )
        base = obter_settings().frontend_base_url.rstrip("/")
        enviados = falhados = 0
        for d in destinatarios:
            try:
                self._email.enviar(destinatario=d.email, assunto=ASSUNTO, corpo_html=_corpo(d.nome, base))
                enviados += 1
            except EmailEnvioFalhouError:
                falhados += 1
                logger.warning("Lembrete de treino não enviado ao utilizador %s", d.id)
        return ResultadoLembretes(enviados=enviados, falhados=falhados)


def _corpo(nome: str | None, base: str) -> str:
    # O nome é escrito pelo próprio utilizador: escapar sempre antes de o pôr em HTML.
    primeiro = html.escape(nome.split()[0]) if nome and nome.strip() else ""
    saudacao = f"Olá, {primeiro}!" if primeiro else "Olá!"
    return (
        f"<p>{saudacao}</p>"
        "<p>Ainda não fez o treino de hoje. Um treino curto todos os dias é o que mantém a "
        "evolução do olho mais fraco: são cerca de 6 minutos.</p>"
        f'<p><a href="{base}/exercicios">Treinar agora</a></p>'
        "<p>Os treinos complementam o tratamento prescrito pelo oftalmologista; não o substituem.</p>"
        "<p style=\"color:#666;font-size:12px\">Recebe este email porque activou os lembretes de "
        f'exercícios. Para deixar de os receber, desactive-os em <a href="{base}/configuracoes">Configurações</a>.</p>'
    )
