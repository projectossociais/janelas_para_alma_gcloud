from datetime import datetime

from pydantic import BaseModel, Field


class NotificacaoEnviar(BaseModel):
    titulo: str = Field(min_length=1, max_length=200)
    mensagem: str = Field(min_length=1, max_length=2000)
    # None = todos; caso contrário um papel válido (ver PAPEIS_VALIDOS no service).
    papel: str | None = None
    # Além da notificação dentro da app (sino do site) -- também por email.
    enviar_email: bool = False


class NotificacaoEnviada(BaseModel):
    enviadas: int
    # Só relevantes quando `enviar_email=True` foi pedido -- 0/0 caso
    # contrário (nunca None, ver ResultadoEnvio no service).
    emails_enviados: int = 0
    emails_falharam: int = 0


class NotificacaoPublica(BaseModel):
    id: str
    titulo: str
    mensagem: str
    lida: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ContagemNaoLidas(BaseModel):
    contagem: int
