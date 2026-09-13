"""Formas dos dados de autenticação — nada de dict solto vindo do cliente."""

from datetime import datetime

from pydantic import BaseModel, EmailStr, field_validator

PASSWORD_MIN_LEN = 8

# Papéis que um utilizador pode escolher para si próprio no registo. Os
# restantes (admin, oftalmologista, voluntario) são atribuídos por outro
# meio (painel administrativo) — nunca pela própria pessoa a registar-se.
# O utilizador podia mentir sobre isto (enviar "admin" directamente à API,
# sem passar pelo <Select> do formulário), por isso a validação vive aqui,
# não só na interface.
PAPEIS_AUTO_REGISTAVEIS = {"comum", "estrabico", "profissional"}


def validar_password_forte(v: str) -> str:
    if len(v) < PASSWORD_MIN_LEN:
        raise ValueError(f"a password precisa de pelo menos {PASSWORD_MIN_LEN} caracteres")
    return v


class UtilizadorCriar(BaseModel):
    email: EmailStr
    password: str
    nome_completo: str | None = None
    provincia: str | None = None
    genero: str | None = None
    papel: str = "comum"

    _valida_password = field_validator("password")(validar_password_forte)

    @field_validator("papel")
    @classmethod
    def papel_auto_registavel(cls, v: str) -> str:
        if v not in PAPEIS_AUTO_REGISTAVEIS:
            raise ValueError(f"papel '{v}' não pode ser escolhido no auto-registo")
        return v


class UtilizadorLogin(BaseModel):
    email: EmailStr
    password: str


class SolicitarRecuperacaoPassword(BaseModel):
    email: EmailStr


class RedefinirPassword(BaseModel):
    token: str
    password_nova: str

    _valida_password = field_validator("password_nova")(validar_password_forte)


class UtilizadorPublico(BaseModel):
    id: str
    email: str
    papel: str
    nome_completo: str | None = None
    provincia: str | None = None
    genero: str | None = None
    criado_em: datetime
    # true só na resposta de /auth/entrar, quando voltar a entrar cancelou
    # um pedido de eliminação de conta agendado. Ver routers/conta.py.
    eliminacao_cancelada: bool = False

    model_config = {"from_attributes": True}


# Sem schema de tokens aqui de propósito: a sessão viaja em cookies
# `httpOnly` (ver routers/auth.py), nunca no corpo JSON — um token que nunca
# passa por `localStorage` nem por JavaScript não pode ser roubado por XSS.
