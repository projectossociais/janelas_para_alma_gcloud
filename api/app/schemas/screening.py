from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class LandmarkEntrada(BaseModel):
    x: float
    y: float
    z: float | None = None


class PoseLandmarksEntrada(BaseModel):
    """Landmarks do MediaPipe FaceMesh já extraídos no browser para uma das
    3 poses guiadas. **Sem imagem** — só coordenadas (CLAUDE.md secção 4)."""

    pose: Literal["center", "right", "left"]
    landmarks: list[LandmarkEntrada] = Field(default_factory=list)


class ScreeningCriar(BaseModel):
    """O que `Scanner.tsx` envia no fim da captura guiada. **Sem
    `user_id`** — de quem é a sessão vem do JWT, nunca do corpo."""

    poses: list[PoseLandmarksEntrada] = Field(min_length=1, max_length=3)
    ambiente_escuro_em_algum_momento: bool = False


class ScreeningPublica(BaseModel):
    id: str
    user_id: str
    estado: str
    rosto_detetado: bool
    requer_avaliacao_humana: bool
    assimetria_horizontal: float | None
    assimetria_vertical: float | None
    qualidade_captura: float | None
    qualidade_fiavel: bool | None
    qualidade_motivos: list[str]
    versao_analise: str
    criado_em: datetime

    model_config = {"from_attributes": True}
