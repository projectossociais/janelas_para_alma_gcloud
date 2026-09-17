"""W-11 — confirmação de pagamento activa o Premium.

Isto é lógica de dinheiro e de acesso: vive num service, com testes, e nunca
confia num id vindo do corpo do pedido (o `admin_id` vem sempre do JWT do
router). Ver CLAUDE.md secções 3, 4 e 10, e docs/BACKLOG.md (W-11).

O que o utilizador podia falsear e é recusado aqui:
- aprovar um pedido que não existe → `PedidoNaoEncontradoError`
- aprovar duas vezes (esticava a validade sem novo pagamento) →
  `PedidoJaAprovadoError`
- aprovar um pedido anónimo, sem conta ligada, não há quem activar →
  `PedidoSemContaError`
"""

from datetime import UTC, datetime, timedelta

from app.repositories.premium_repository import PedidoPremiumRegisto, PremiumRepository
from app.services.comprovativo_upload_service import url_publico_do_comprovativo

PREMIUM_DURACAO_DIAS = 30


class PedidoNaoEncontradoError(Exception):
    pass


class PedidoJaAprovadoError(Exception):
    pass


class PedidoSemContaError(Exception):
    pass


class PremiumService:
    def __init__(self, repositorio: PremiumRepository) -> None:
        self._repo = repositorio

    def criar_pedido(
        self,
        nome: str,
        email: str,
        telefone: str | None,
        plano: str | None,
        user_id: str | None,
        comprovativo_chave: str,
    ) -> PedidoPremiumRegisto:
        """CROSS-02: o comprovativo já foi enviado directamente ao R2 (ver
        `uploads.py`) -- aqui só se confirma que a chave apresentada é
        mesmo um comprovativo (nunca um caminho arbitrário do bucket)
        antes de a gravar. Um admin só aprova o pagamento depois de ver
        este ficheiro (ver `AdminInbox.tsx`)."""
        comprovativo_url = url_publico_do_comprovativo(comprovativo_chave)
        return self._repo.criar(
            nome=nome,
            email=email,
            telefone=telefone,
            plano=plano,
            user_id=user_id,
            comprovativo_url=comprovativo_url,
        )

    def aprovar_pagamento(self, pedido_id: str, admin_id: str) -> PedidoPremiumRegisto:
        pedido = self._repo.obter(pedido_id)
        if pedido is None:
            raise PedidoNaoEncontradoError(pedido_id)
        if pedido.status == "aprovado":
            raise PedidoJaAprovadoError(pedido_id)
        if pedido.user_id is None:
            raise PedidoSemContaError(pedido_id)

        agora = datetime.now(UTC)
        expira_em = agora + timedelta(days=PREMIUM_DURACAO_DIAS)
        return self._repo.aprovar_pagamento(pedido_id, admin_id, agora, expira_em)

    def revogar(self, pedido_id: str, admin_id: str) -> PedidoPremiumRegisto:
        pedido = self._repo.obter(pedido_id)
        if pedido is None:
            raise PedidoNaoEncontradoError(pedido_id)
        return self._repo.revogar(pedido_id, admin_id, datetime.now(UTC))
