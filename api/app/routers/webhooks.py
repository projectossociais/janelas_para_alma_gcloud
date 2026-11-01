"""Webhooks de serviços externos, nunca de um browser. Hoje só o RevenueCat
(compras na app nativa) -- protegido por `obter_webhook_revenuecat_valido`
(segredo no `Authorization`), nunca por sessão de utilizador."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.config import obter_settings
from app.core.dependencies import obter_webhook_revenuecat_valido
from app.db import obter_sessao
from app.repositories.compras_loja_repository import SQLAlchemyCompraLojaRepository
from app.schemas.webhooks import WebhookProcessado, WebhookRevenueCat
from app.services.compra_loja_service import CompraLojaService, EventoLoja

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


def obter_compra_loja_service(sessao: Session = Depends(obter_sessao)) -> CompraLojaService:
    return CompraLojaService(
        SQLAlchemyCompraLojaRepository(sessao),
        aceitar_sandbox=obter_settings().revenuecat_aceitar_sandbox,
    )


@router.post(
    "/revenuecat",
    response_model=WebhookProcessado,
    dependencies=[Depends(obter_webhook_revenuecat_valido)],
)
def webhook_revenuecat(
    corpo: WebhookRevenueCat,
    servico: CompraLojaService = Depends(obter_compra_loja_service),
) -> WebhookProcessado:
    """Sempre 200 para eventos que não interessam (ou repetidos): um erro
    faria o RevenueCat repetir o mesmo evento. Só uma falha real (base de
    dados em baixo) devolve 5xx -- aí repetir é o que se quer."""
    e = corpo.event
    resultado = servico.processar(
        EventoLoja(
            tipo=e.type,
            utilizador_id=e.app_user_id,
            loja=e.store,
            ambiente=e.environment,
            produto_id=e.product_id,
            transacao_id=e.transaction_id,
            transacao_original_id=e.original_transaction_id,
            comprado_em=e.comprado_em,
            expira_em=e.expira_em,
            motivo_cancelamento=e.cancel_reason,
        )
    )
    return WebhookProcessado(resultado=resultado)
