from datetime import datetime

from pydantic import BaseModel, Field


class NotificacaoEnviar(BaseModel):
    titulo: str = Field(min_length=1, max_length=200)
    mensagem: str = Field(min_length=1, max_length=2000)
    # None = todos; caso contrário um papel válido (ver PAPEIS_VALIDOS no service).
    papel: str | None = None


class NotificacaoEnviada(BaseModel):
    enviadas: int


class NotificacaoPublica(BaseModel):
    id: str
    titulo: str
    mensagem: str
    lida: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ContagemNaoLidas(BaseModel):
    contagem: int
