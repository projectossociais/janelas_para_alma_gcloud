"""Formas dos dados do perfil de clínica e da equipa que a gere."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field

Modalidade = Literal["presencial", "online"]


class ClinicaParceiraAdmin(BaseModel):
    """Visto no painel de administração e no portal da própria clínica --
    o perfil completo, ao contrário de `ClinicaParceiraPublica`
    (`schemas/agendamento.py`), que só expõe `id`/`nome` publicamente."""

    id: str
    nome: str
    email_contacto: str
    telefone_contacto: str
    ativa: bool
    especialidades: list[str]
    cidade: str | None
    modalidades_suportadas: list[Modalidade | str]
    preco_indicativo: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ClinicaPerfilAtualizar(BaseModel):
    especialidades: list[str] = Field(default_factory=list)
    cidade: str | None = Field(default=None, max_length=100)
    modalidades_suportadas: list[Modalidade] = Field(default_factory=list)
    preco_indicativo: str | None = Field(default=None, max_length=100)


class EquipaClinicaAdicionar(BaseModel):
    """Liga uma conta já existente à clínica -- pelo email, nunca por um
    `utilizador_id` solto (nunca confiar num id vindo do corpo, CLAUDE.md
    secção 4)."""

    email: EmailStr


class MembroEquipaPublico(BaseModel):
    id: str
    utilizador_id: str
    utilizador_email: str
    utilizador_nome: str | None
    clinica_id: str
    created_at: datetime

    model_config = {"from_attributes": True}
