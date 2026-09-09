"""Formas dos dados de autenticação — nada de dict solto vindo do cliente."""

from datetime import datetime

from pydantic import BaseModel, EmailStr, field_validator

PASSWORD_MIN_LEN = 8


class UtilizadorCriar(BaseModel):
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def password_forte(cls, v: str) -> str:
        if len(v) < PASSWORD_MIN_LEN:
            raise ValueError(f"a password precisa de pelo menos {PASSWORD_MIN_LEN} caracteres")
        return v


class UtilizadorLogin(BaseModel):
    email: EmailStr
    password: str


class UtilizadorPublico(BaseModel):
    id: str
    email: str
    papel: str
    criado_em: datetime

    model_config = {"from_attributes": True}


class ParDeTokens(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshTokenPedido(BaseModel):
    refresh_token: str
