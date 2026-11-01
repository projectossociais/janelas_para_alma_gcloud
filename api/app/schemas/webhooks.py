"""Corpo do webhook do RevenueCat (compras na app nativa). Só os campos que
usamos; o resto do evento ignora-se. Ver services/compra_loja_service.py."""

from datetime import UTC, datetime

from pydantic import BaseModel, ConfigDict


def _de_ms(valor: int | None) -> datetime | None:
    return datetime.fromtimestamp(valor / 1000, tz=UTC) if valor is not None else None


class EventoRevenueCat(BaseModel):
    model_config = ConfigDict(extra="ignore")

    type: str
    app_user_id: str = ""
    store: str = ""
    environment: str = ""
    product_id: str | None = None
    transaction_id: str | None = None
    original_transaction_id: str | None = None
    purchased_at_ms: int | None = None
    expiration_at_ms: int | None = None
    cancel_reason: str | None = None

    @property
    def comprado_em(self) -> datetime | None:
        return _de_ms(self.purchased_at_ms)

    @property
    def expira_em(self) -> datetime | None:
        return _de_ms(self.expiration_at_ms)


class WebhookRevenueCat(BaseModel):
    model_config = ConfigDict(extra="ignore")

    event: EventoRevenueCat


class WebhookProcessado(BaseModel):
    resultado: str
