from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class PedidoPremiumCriar(BaseModel):
    """O que o formulário `RegistoPremium.tsx` envia. Se houver sessão, o
    router liga o `user_id` — nunca vem do corpo."""

    nome: str = Field(min_length=1, max_length=150)
    email: EmailStr
    telefone: str | None = Field(default=None, max_length=40)
    plano: str | None = Field(default=None, max_length=60)


class PedidoPremiumPublico(BaseModel):
    """Devolvido a quem submete o pedido."""

    id: str
    nome: str
    email: str
    telefone: str | None
    plano: str | None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class PedidoPremiumAdmin(PedidoPremiumPublico):
    """Visto no painel de administração — inclui a auditoria."""

    user_id: str | None
    aprovado_por: str | None
    aprovado_em: datetime | None
