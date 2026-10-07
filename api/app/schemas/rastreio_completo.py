from typing import Literal

from pydantic import BaseModel, Field


class MedicoesRastreioCriar(BaseModel):
    """O que o motor no telemóvel mediu. **Sem qualquer imagem** (CLAUDE.md §4.4) e
    sem ``user_id`` (vem do JWT). Números finitos: ``NaN``/``Infinity`` nem entram."""

    horizontal_delta: float = Field(allow_inf_nan=False, ge=-1000, le=1000)
    vertical_delta: float = Field(allow_inf_nan=False, ge=-1000, le=1000)
    dispersao_delta: float = Field(allow_inf_nan=False, ge=0, le=1000)
    fotografias_validas: int = Field(ge=0, le=20)
    fotografias_total: int = Field(ge=0, le=20)
    falha: str | None = Field(default=None, max_length=60)
    versao_motor: str = Field(min_length=1, max_length=60)


class ResultadoRastreioPublico(BaseModel):
    conclusao: Literal["encaminhar", "sem_sinais", "nao_mediu"]
    motivo: str | None
    versao_regra: str
    # Preenchido só se ficou gravado no histórico da conta.
    screening_id: str | None
