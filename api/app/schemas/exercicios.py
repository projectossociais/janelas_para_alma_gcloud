from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class AcessoExerciciosPublico(BaseModel):
    """Estado de acesso aos exercícios, já calculado pela API — o frontend
    só mostra isto, nunca decide acesso comparando datas por conta própria.
    `sem_sessao` é para visitantes (a rota não exige sessão)."""

    estado: Literal["sem_sessao", "premium", "trial_disponivel", "trial_ativo", "trial_terminado"]
    exercicios_desbloqueados: list[str]
    exercicios_trial: list[str]
    exercicios_premium: list[str]
    trial_iniciado_em: datetime | None = None
    trial_termina_em: datetime | None = None
    trial_dias_restantes: int | None = None


class VideoExercicioPublico(BaseModel):
    url: str
