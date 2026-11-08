"""Compras feitas dentro da app nativa, pela App Store ou pelo Google Play
(2026-10-30, decisão do dono do projecto: na app, o Premium e a loja do jogo
vendem-se pelas lojas, que proíbem a transferência + comprovativo para
produtos digitais).

A app compra pelo SDK do RevenueCat, configurado com o `id` do utilizador
como `app_user_id`. O RevenueCat confirma o recibo junto da Apple/Google e
chama o webhook (`routers/webhooks.py`), que chega aqui. **O frontend nunca
credita nada** -- só espera que a API reflicta a compra.

Regras:
- Cada transacção da loja aplica-se uma única vez (índice único em
  `compras_loja`; o RevenueCat repete o webhook até receber 200).
- Premium: cada compra ou renovação **soma** o período pago à validade
  actual (como um comprovativo aprovado), no máximo 35 dias por transacção.
  Não há nada a fazer quando a subscrição acaba: a validade já termina sozinha.
- Diamantes e moedas: a quantidade vem do catálogo da loja do jogo
  (`PACOTES_DIAMANTES` / `PACOTES_MOEDAS`), nunca do evento.
- Reembolso (CANCELLATION com `CUSTOMER_SUPPORT`): desfaz só o que essa
  transacção deu.
- Compras de teste (sandbox) contam: o revisor da Apple compra em sandbox
  na app de produção. `aceitar_sandbox=False` desliga-as.
- Os preços vivem nas consolas das lojas, não aqui.
"""

import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Literal

from app.repositories.compras_loja_repository import (
    CompraLojaRepository,
    Loja,
    NovaCompraLoja,
    TipoCompraLoja,
)
from app.services.loja_jogo_service import PACOTES_DIAMANTES, PACOTES_MOEDAS
from app.services.premium_service import PREMIUM_DURACAO_DIAS

logger = logging.getLogger(__name__)

PRODUTO_PREMIUM_MENSAL = "jpa_premium_mensal"
PREFIXO_DIAMANTES = "jpa_diamantes_"
PREFIXO_MOEDAS = "jpa_moedas_"

# Tecto por transacção: um mês de calendário mais folga para atrasos de
# cobrança. Um evento com um período maior nunca dá mais do que isto.
PREMIUM_MAXIMO_POR_TRANSACAO = timedelta(days=35)

EVENTOS_DE_COMPRA = frozenset({"INITIAL_PURCHASE", "RENEWAL", "NON_RENEWING_PURCHASE"})

_LOJAS: dict[str, Loja] = {"APP_STORE": "app_store", "PLAY_STORE": "play_store"}

ResultadoEvento = Literal["aplicada", "repetida", "reembolsada", "ignorada"]


@dataclass(frozen=True)
class EventoLoja:
    """O que interessa de um evento do RevenueCat, já sem HTTP."""

    tipo: str
    utilizador_id: str
    loja: str
    ambiente: str
    produto_id: str | None
    transacao_id: str | None
    transacao_original_id: str | None
    comprado_em: datetime | None
    expira_em: datetime | None
    motivo_cancelamento: str | None


@dataclass(frozen=True)
class ProdutoLoja:
    tipo: TipoCompraLoja
    quantidade: int | None


def produto_do_catalogo(produto_id: str) -> ProdutoLoja | None:
    """No Google Play, uma subscrição chega como `subscricao:plano_base`."""
    base = produto_id.split(":", 1)[0]
    if base == PRODUTO_PREMIUM_MENSAL:
        return ProdutoLoja(tipo="premium", quantidade=None)
    if base.startswith(PREFIXO_DIAMANTES):
        pacote = next((p for p in PACOTES_DIAMANTES if p.id == base.removeprefix(PREFIXO_DIAMANTES)), None)
        return ProdutoLoja(tipo="diamantes", quantidade=pacote.total_diamantes) if pacote else None
    if base.startswith(PREFIXO_MOEDAS):
        pacote = next((p for p in PACOTES_MOEDAS if p.id == base.removeprefix(PREFIXO_MOEDAS)), None)
        return ProdutoLoja(tipo="moedas", quantidade=pacote.total_moedas) if pacote else None
    return None


class CompraLojaService:
    def __init__(
        self,
        repo: CompraLojaRepository,
        aceitar_sandbox: bool = True,
        relogio=lambda: datetime.now(UTC),
    ) -> None:
        self._repo = repo
        self._aceitar_sandbox = aceitar_sandbox
        self._relogio = relogio

    def processar(self, evento: EventoLoja) -> ResultadoEvento:
        loja = _LOJAS.get(evento.loja)
        if loja is None or not evento.transacao_id:
            return "ignorada"
        sandbox = evento.ambiente != "PRODUCTION"
        if sandbox and not self._aceitar_sandbox:
            return "ignorada"
        if evento.tipo == "CANCELLATION" and evento.motivo_cancelamento == "CUSTOMER_SUPPORT":
            return self._reembolsar(loja, evento.transacao_id)
        if evento.tipo not in EVENTOS_DE_COMPRA:
            return "ignorada"
        produto = produto_do_catalogo(evento.produto_id or "")
        if produto is None:
            # Produto criado na consola da loja sem correspondência aqui.
            logger.error("compra na loja com produto desconhecido: %s", evento.produto_id)
            return "ignorada"
        if not self._repo.conta_activa(evento.utilizador_id):
            logger.warning("compra na loja de uma conta inexistente ou anonimizada (transacção %s)", evento.transacao_id)
            return "ignorada"

        segundos = int(self._periodo_premium(evento).total_seconds()) if produto.tipo == "premium" else None
        compra = NovaCompraLoja(
            utilizador_id=evento.utilizador_id,
            loja=loja,
            ambiente="sandbox" if sandbox else "producao",
            produto_id=evento.produto_id or "",
            tipo=produto.tipo,
            quantidade=produto.quantidade,
            premium_segundos=segundos,
            transacao_id=evento.transacao_id,
            transacao_original_id=evento.transacao_original_id,
            comprado_em=evento.comprado_em or self._relogio(),
        )
        somar = self._somar_premium(segundos) if segundos is not None else None
        return "aplicada" if self._repo.registar(compra, somar) else "repetida"

    def _reembolsar(self, loja: Loja, transacao_id: str) -> ResultadoEvento:
        agora = self._relogio()

        def retirar(actual: datetime | None, segundos: int) -> datetime | None:
            if actual is None:
                return None
            restante = actual - timedelta(seconds=segundos)
            return restante if restante > agora else None

        return "reembolsada" if self._repo.reembolsar(loja, transacao_id, agora, retirar) else "ignorada"

    @staticmethod
    def _periodo_premium(evento: EventoLoja) -> timedelta:
        """O período que a loja cobrou (o sandbox encurta um mês para
        minutos), com tecto; sem datas, os 30 dias do Premium."""
        if evento.comprado_em and evento.expira_em and evento.expira_em > evento.comprado_em:
            return min(evento.expira_em - evento.comprado_em, PREMIUM_MAXIMO_POR_TRANSACAO)
        return timedelta(days=PREMIUM_DURACAO_DIAS)

    def _somar_premium(self, segundos: int):
        """Soma a partir da validade actual (renovar antes do fim não perde
        dias), ou a partir de agora se o Premium já não estiver activo."""
        agora = self._relogio()

        def ajustar(actual: datetime | None) -> datetime:
            base = actual if actual is not None and actual > agora else agora
            return base + timedelta(seconds=segundos)

        return ajustar
