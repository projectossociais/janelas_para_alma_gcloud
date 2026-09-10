from datetime import datetime

from pydantic import BaseModel, Field


class SessaoExercicioCriar(BaseModel):
    """O que o browser envia ao terminar um exercício. **Sem `user_id`** —
    de quem é a sessão vem do JWT, nunca do corpo (CLAUDE.md secção 4.1).
    `pontuacao`/`precisao_percentual`/`detalhes` são opcionais: exercícios
    de relaxamento não pontuam."""

    exercicio_id: str = Field(min_length=1, max_length=100)
    duracao_segundos: int = Field(ge=1, le=24 * 60 * 60)
    pontuacao: int = Field(default=0, ge=0)
    precisao_percentual: float = Field(default=0, ge=0, le=100)
    detalhes: dict | None = None


class SessaoExercicioPublica(BaseModel):
    id: str
    user_id: str
    exercicio_id: str
    duracao_segundos: int
    pontuacao: int
    precisao_percentual: float
    detalhes: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}
