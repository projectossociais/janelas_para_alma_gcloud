"""Formas dos dados do voluntariado — candidaturas, actividades, inscrições."""

from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class CandidaturaVoluntariadoCriar(BaseModel):
    motivacao: str = Field(min_length=1, max_length=1000)
    telefone: str | None = Field(default=None, max_length=40)


class CandidaturaVoluntariadoPublica(BaseModel):
    """Devolvido a quem se candidata — vê o estado da própria candidatura."""

    id: str
    motivacao: str
    telefone: str | None
    status: str
    decidido_em: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class CandidaturaVoluntariadoAdmin(CandidaturaVoluntariadoPublica):
    """Visto no painel de administração — inclui quem se candidatou."""

    utilizador_id: str
    utilizador_email: str
    utilizador_nome: str | None
    decidido_por: str | None


class AtividadeVoluntariadoCriar(BaseModel):
    titulo: str = Field(min_length=1, max_length=150)
    descricao: str = Field(min_length=1, max_length=2000)
    local: str = Field(min_length=1, max_length=200)
    data_inicio: datetime
    data_fim: datetime | None = None
    vagas: int | None = Field(default=None, gt=0)

    @field_validator("data_fim")
    @classmethod
    def _fim_depois_do_inicio(cls, v: datetime | None, info) -> datetime | None:
        inicio = info.data.get("data_inicio")
        if v is not None and inicio is not None and v < inicio:
            raise ValueError("a data de fim não pode ser anterior à data de início")
        return v


class AtividadeVoluntariadoPublica(BaseModel):
    """O que um voluntário activo vê ao listar actividades disponíveis."""

    id: str
    titulo: str
    descricao: str
    local: str
    data_inicio: datetime
    data_fim: datetime | None
    vagas: int | None
    inscritos: int
    estado: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AtividadeVoluntariadoAdmin(AtividadeVoluntariadoPublica):
    """Visto no painel de administração — inclui quem publicou."""

    criado_por: str | None


class InscricaoAtividadePublica(BaseModel):
    """O que um voluntário vê em "as minhas actividades"."""

    id: str
    atividade_id: str
    atividade_titulo: str
    atividade_data_inicio: datetime
    atividade_local: str
    estado: str
    created_at: datetime

    model_config = {"from_attributes": True}


class InscricaoAtividadeAdmin(InscricaoAtividadePublica):
    """Visto no painel de administração — quem se inscreveu numa actividade."""

    utilizador_id: str
    utilizador_email: str
    utilizador_nome: str | None
