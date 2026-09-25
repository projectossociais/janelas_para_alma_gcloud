"""Formas dos dados do ciclo de vida da teleconsulta (Fase 2 do matchmaker)."""

from datetime import datetime

from pydantic import BaseModel, Field


class TeleconsultaPublica(BaseModel):
    id: str
    agendamento_id: str
    sala_video: str
    estado: str
    iniciada_em: datetime | None
    concluida_em: datetime | None
    recomendacao_clinica: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class TeleconsultaConcluir(BaseModel):
    recomendacao_clinica: str = Field(min_length=1, max_length=4000)
