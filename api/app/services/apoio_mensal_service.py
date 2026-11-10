"""Apoio mensal (Kamba Mensal, 2026-10-26): doação recorrente sem gateway.

Não há débito automático em Angola sem um gateway de pagamentos, e o projecto
não tem nenhum (ver CLAUDE.md, Premium). Por isso um apoio mensal é uma
**promessa** ligada à conta: a pessoa escolhe um valor por mês, transfere-o
ela própria e envia o comprovativo, tal como numa doação única. Cada
comprovativo fica em `doacoes` (financeira, `status = comprovativo_enviado`)
ligado ao apoio, e a equipa confirma-o como confirma qualquer doação.

Regras decididas aqui:
- valor entre `VALOR_MINIMO_KZ` e `VALOR_MAXIMO_KZ`, inteiro (Kwanzas);
- no máximo um apoio activo por conta (o repository garante-o também com um
  índice único parcial, para pedidos em simultâneo);
- um mês passa a estar "em falta" `DIAS_POR_CICLO` dias depois do último
  comprovativo (ou da adesão, antes do primeiro);
- o lembrete por email (`POST /interno/lembretes-apoio-mensal`, Cloud
  Scheduler) vai a quem tem o mês em falta e não recebeu lembrete nos últimos
  `DIAS_POR_CICLO` dias -- um por ciclo, nunca insistente.

Ler o comprovativo não prova que o dinheiro entrou (o mesmo limite do Premium):
a contagem de meses é de comprovativos enviados, não de pagamentos confirmados.
"""

import html
import logging
import uuid
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from app.core.config import obter_settings
from app.core.email import EmailEnvioFalhouError, EmailSender
from app.repositories.apoios_mensais_repository import (
    ApoioMensalJaActivoError,
    ApoioMensalRegisto,
    ApoiosMensaisRepository,
)
from app.services.comprovativo_upload_service import referencia_do_comprovativo

logger = logging.getLogger(__name__)

VALOR_MINIMO_KZ = 1_000
VALOR_MAXIMO_KZ = 10_000_000
DIAS_POR_CICLO = 30
ASSUNTO_LEMBRETE = "Está na altura do seu apoio mensal ao Janelas Para a Alma"


class ValorMensalInvalidoError(Exception):
    pass


class ApoioMensalJaExisteError(Exception):
    pass


class ApoioMensalNaoEncontradoError(Exception):
    pass


@dataclass(frozen=True)
class EstadoApoioMensal:
    id: str
    valor_mensal_kz: int
    estado: str
    criado_em: datetime
    ultimo_comprovativo_em: datetime | None
    meses_com_comprovativo: int
    renovacao_em_falta: bool


@dataclass(frozen=True)
class ResultadoLembretesApoio:
    enviados: int
    falhados: int


def _formatar_kz(valor: int) -> str:
    return f"{valor:,}".replace(",", ".") + " Kz"


class ApoioMensalService:
    def __init__(
        self,
        repositorio: ApoiosMensaisRepository,
        email_sender: EmailSender,
        relogio: Callable[[], datetime] = lambda: datetime.now(UTC),
    ) -> None:
        self._repo = repositorio
        self._email = email_sender
        self._relogio = relogio

    def _estado(self, apoio: ApoioMensalRegisto) -> EstadoApoioMensal:
        referencia = apoio.ultimo_comprovativo_em or apoio.criado_em
        return EstadoApoioMensal(
            id=apoio.id,
            valor_mensal_kz=apoio.valor_mensal_kz,
            estado=apoio.estado,
            criado_em=apoio.criado_em,
            ultimo_comprovativo_em=apoio.ultimo_comprovativo_em,
            meses_com_comprovativo=apoio.meses_com_comprovativo,
            renovacao_em_falta=self._relogio() - referencia >= timedelta(days=DIAS_POR_CICLO),
        )

    def obter(self, utilizador_id: str) -> EstadoApoioMensal | None:
        apoio = self._repo.obter_activo(utilizador_id)
        return self._estado(apoio) if apoio else None

    def aderir(self, utilizador_id: str, valor_mensal_kz: int) -> EstadoApoioMensal:
        if not VALOR_MINIMO_KZ <= valor_mensal_kz <= VALOR_MAXIMO_KZ:
            raise ValorMensalInvalidoError(
                f"o valor mensal tem de estar entre {_formatar_kz(VALOR_MINIMO_KZ)} e {_formatar_kz(VALOR_MAXIMO_KZ)}"
            )
        if self._repo.obter_activo(utilizador_id) is not None:
            raise ApoioMensalJaExisteError("esta conta já tem um apoio mensal activo")
        try:
            return self._estado(self._repo.criar(utilizador_id, valor_mensal_kz))
        except ApoioMensalJaActivoError as exc:  # pedido em simultâneo que passou a verificação acima
            raise ApoioMensalJaExisteError("esta conta já tem um apoio mensal activo") from exc

    def registar_comprovativo(self, utilizador_id: str, email: str, comprovativo_chave: str) -> EstadoApoioMensal:
        """O comprovativo já foi enviado directamente ao R2; aqui valida-se a
        chave (nunca um caminho arbitrário do bucket) e grava-se a doação do
        mês com o apoio, numa só transacção. A confirmação por email segue o
        padrão das doações: uma falha no envio é uma falha do pedido."""
        apoio = self._repo.obter_activo(utilizador_id)
        if apoio is None:
            raise ApoioMensalNaoEncontradoError("esta conta não tem um apoio mensal activo")
        comprovativo_url = referencia_do_comprovativo(comprovativo_chave)
        recibo_id = f"MEN-{uuid.uuid4().hex[:10].upper()}"
        actualizado = self._repo.registar_comprovativo(
            apoio_id=apoio.id,
            recibo_id=recibo_id,
            email=email,
            detalhes=f"Apoio mensal (Kamba Mensal): {_formatar_kz(apoio.valor_mensal_kz)}/mês",
            comprovativo_url=comprovativo_url,
            momento=self._relogio(),
        )
        self._email.enviar(
            destinatario=email,
            assunto="Recebemos o comprovativo do seu apoio mensal — Janelas Para a Alma",
            corpo_html=(
                f"<p>Obrigado por continuar connosco! Recebemos o comprovativo deste mês, com o recibo "
                f"<strong>{recibo_id}</strong>.</p>"
                "<p>A nossa equipa vai confirmar a transferência em breve.</p>"
            ),
        )
        return self._estado(actualizado)

    def cancelar(self, utilizador_id: str) -> None:
        apoio = self._repo.obter_activo(utilizador_id)
        if apoio is None:
            raise ApoioMensalNaoEncontradoError("esta conta não tem um apoio mensal activo")
        self._repo.cancelar(apoio.id, self._relogio())

    def enviar_lembretes(self) -> ResultadoLembretesApoio:
        agora = self._relogio()
        destinatarios = self._repo.listar_para_lembrete(limite=agora - timedelta(days=DIAS_POR_CICLO))
        base = obter_settings().frontend_base_url.rstrip("/")
        enviados = falhados = 0
        for d in destinatarios:
            try:
                self._email.enviar(
                    destinatario=d.email, assunto=ASSUNTO_LEMBRETE, corpo_html=_corpo_lembrete(d.nome, d.valor_mensal_kz, base)
                )
            except EmailEnvioFalhouError:
                falhados += 1
                logger.warning("Lembrete do apoio mensal %s não enviado", d.apoio_id)
                continue
            # Só se marca depois de enviado: uma falha volta a tentar no dia seguinte.
            self._repo.marcar_lembrete(d.apoio_id, agora)
            enviados += 1
        return ResultadoLembretesApoio(enviados=enviados, falhados=falhados)


def _corpo_lembrete(nome: str | None, valor: int, base: str) -> str:
    # O nome é escrito pelo próprio utilizador: escapar sempre antes de o pôr em HTML.
    primeiro = html.escape(nome.split()[0]) if nome and nome.strip() else ""
    saudacao = f"Olá, {primeiro}!" if primeiro else "Olá!"
    return (
        f"<p>{saudacao}</p>"
        f"<p>Passou um mês desde o último comprovativo do seu apoio de {_formatar_kz(valor)}. "
        "Quando fizer a transferência deste mês, basta enviar o comprovativo na página de apoio.</p>"
        f'<p><a href="{base}/apoiar?modo=mensal">Enviar o comprovativo deste mês</a></p>'
        "<p>Obrigado por fazer parte da família Kamba Mensal.</p>"
        '<p style="color:#666;font-size:12px">Recebe este email porque é Kamba Mensal. Para deixar de '
        f'apoiar mensalmente (e de receber estes lembretes), use <a href="{base}/apoiar?modo=mensal">'
        "a mesma página</a>.</p>"
    )
