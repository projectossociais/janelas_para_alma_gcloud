from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class ContactMessageCriar(BaseModel):
    nome: str = Field(min_length=1, max_length=100)
    email: EmailStr
    mensagem: str = Field(min_length=1, max_length=1000)
    assunto: str | None = Field(default=None, max_length=150)


class ContactMessagePublico(BaseModel):
    id: str
    nome: str
    email: str
    assunto: str | None
    mensagem: str
    created_at: datetime

    model_config = {"from_attributes": True}
