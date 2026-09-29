import json
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

OlhoSessao = Literal["direito", "esquerdo", "ambos"]
# Unidade do `limiar`: logMAR (acuidade, anéis), log da sensibilidade ao
# contraste, segundos de arco (estereopsia), segundos (convergência, perto e
# longe). O astigmatismo não tem limiar -- é Sim/Não, vai em `sinais`.
UnidadeLimiar = Literal["logmar", "log_cs", "arcsec", "segundos"]


class SessaoExercicioCriar(BaseModel):
    """O que o browser envia ao terminar um exercício. **Sem `user_id`** —
    de quem é a sessão vem do JWT, nunca do corpo (CLAUDE.md secção 4.1).
    `pontuacao`/`precisao_percentual`/`detalhes` são opcionais: exercícios
    de relaxamento não pontuam.

    Os campos de `versao` para baixo são dos exercícios sem webcam
    (2026-09-28): todos opcionais, para um bundle antigo em cache continuar a
    gravar (fica `versao` 1)."""

    exercicio_id: str = Field(min_length=1, max_length=100)
    duracao_segundos: int = Field(ge=1, le=24 * 60 * 60)
    pontuacao: int = Field(default=0, ge=0)
    precisao_percentual: float = Field(default=0, ge=0, le=100)
    detalhes: dict | None = None

    versao: Literal[1, 2] = 1
    olho: OlhoSessao | None = None
    segundos_activos: int | None = Field(default=None, ge=0, le=24 * 60 * 60)
    limiar: float | None = Field(default=None, ge=-10_000, le=10_000)
    unidade: UnidadeLimiar | None = None
    distancia_mm: int | None = Field(default=None, ge=100, le=10_000)
    px_por_mm: float | None = Field(default=None, ge=0.5, le=50)
    calibrado: bool | None = None
    sinais: dict | None = None

    @field_validator("sinais")
    @classmethod
    def _sinais_pequenos(cls, valor: dict | None) -> dict | None:
        # Só marcas curtas (ex.: {"baixa_atencao": true}) -- nunca um sítio
        # para despejar dados arbitrários.
        if valor is not None and len(json.dumps(valor)) > 2000:
            raise ValueError("sinais demasiado grandes")
        return valor


class SessaoExercicioPublica(BaseModel):
    id: str
    user_id: str
    exercicio_id: str
    duracao_segundos: int
    pontuacao: int
    precisao_percentual: float
    detalhes: dict | None
    created_at: datetime

    versao: int = 1
    olho: str | None = None
    segundos_activos: int | None = None
    limiar: float | None = None
    unidade: str | None = None
    distancia_mm: int | None = None
    px_por_mm: float | None = None
    calibrado: bool | None = None
    sinais: dict | None = None

    model_config = {"from_attributes": True}


class BonusAssiduidadePublico(BaseModel):
    """Bónus do jogo creditado por este treino (o primeiro que conta no dia)."""

    moedas: int
    diamantes: int
    dias_seguidos: int


class SessaoExercicioGravada(SessaoExercicioPublica):
    """Resposta de `POST /sessoes-exercicio`: a sessão e, se houve, o bónus do dia."""

    bonus: BonusAssiduidadePublico | None = None
