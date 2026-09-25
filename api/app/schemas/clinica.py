"""Formas dos dados do perfil de clínica, da equipa que a gere e da sua
disponibilidade semanal."""

from datetime import datetime, time
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

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


class DisponibilidadeClinicaCriar(BaseModel):
    """`dia_semana` segue `date.weekday()` do Python: 0 = segunda,
    6 = domingo (mesma convenção do modelo ORM e do serviço de agendamento)."""

    dia_semana: int = Field(ge=0, le=6)
    hora_inicio: time
    hora_fim: time
    modalidade: Modalidade

    @field_validator("hora_fim")
    @classmethod
    def _hora_fim_apos_inicio(cls, valor: time, info) -> time:
        inicio = info.data.get("hora_inicio")
        if inicio is not None and valor <= inicio:
            raise ValueError("hora_fim tem de ser depois de hora_inicio")
        return valor


class DisponibilidadeClinicaPublica(BaseModel):
    id: str
    clinica_id: str
    dia_semana: int
    hora_inicio: time
    hora_fim: time
    modalidade: str
    created_at: datetime

    model_config = {"from_attributes": True}
