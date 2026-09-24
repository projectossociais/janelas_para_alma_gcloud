from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

# Sinal real para o matchmaker clínico (Fase 1, docs/BACKLOG.md Sprint 4) --
# só os dois valores que o janelas-scanner-api de facto calcula hoje. Não
# confundir com as 4 subcategorias de estrabismo que o frontend antigo
# mostrava (vinham do Math.random(), removido no PR #61).
Diagnostico = Literal["normal", "requer_avaliacao"]


class ScreeningCriar(BaseModel):
    """O que o browser envia depois de o `janelas-scanner-api` (microserviço
    à parte, dono do cálculo clínico) devolver um resultado de rastreio.
    **Sem `user_id`** — de quem é o rastreio vem do JWT, nunca do corpo
    (CLAUDE.md secção 4.1). **Sem qualquer campo de imagem** — nunca se
    guarda a fotografia em si, só as medições (CLAUDE.md secção 4, regra 4).
    """

    estado: str = Field(min_length=1, max_length=50)
    rosto_detetado: bool
    requer_avaliacao_humana: bool
    diagnostico: Diagnostico = "normal"
    assimetria_horizontal: float | None = None
    assimetria_vertical: float | None = None
    qualidade_captura: float | None = Field(default=None, ge=0, le=1)
    qualidade_fiavel: bool | None = None
    qualidade_motivos: list[str] = Field(default_factory=list)
    medicoes: dict | None = None
    versao_analise: str | None = Field(default=None, max_length=100)


class ScreeningPublica(BaseModel):
    id: str
    user_id: str
    estado: str
    rosto_detetado: bool
    requer_avaliacao_humana: bool
    diagnostico: str
    assimetria_horizontal: float | None
    assimetria_vertical: float | None
    qualidade_captura: float | None
    qualidade_fiavel: bool | None
    qualidade_motivos: list[str]
    medicoes: dict | None
    versao_analise: str | None
    criado_em: datetime

    model_config = {"from_attributes": True}
