from datetime import datetime

from pydantic import BaseModel, field_validator

from app.schemas.auth import validar_password_forte


class MudarPasswordPedido(BaseModel):
    password_atual: str
    password_nova: str

    _valida_password_nova = field_validator("password_nova")(validar_password_forte)


class EliminacaoAgendada(BaseModel):
    agendada_para: datetime
