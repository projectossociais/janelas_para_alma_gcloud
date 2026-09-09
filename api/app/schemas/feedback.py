from datetime import datetime

from pydantic import BaseModel, Field


class FeedbackCriar(BaseModel):
    avaliacao: int = Field(ge=1, le=5)
    comentario: str | None = Field(default=None, max_length=500)


class FeedbackPublico(BaseModel):
    id: str
    avaliacao: int
    comentario: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
