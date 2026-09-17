from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class DoacaoMateriaisCriar(BaseModel):
    email: EmailStr
    materiais: list[str]
    detalhes: str | None = None


class DoacaoFinanceiraCriar(BaseModel):
    email: EmailStr
    detalhes: str | None = None
    # Chave devolvida por POST /uploads/comprovativo, depois do PUT ao R2
    # já ter corrido -- ver comprovativo_upload_service.py.
    comprovativo_chave: str = Field(min_length=1, max_length=300)


class DoacaoPublica(BaseModel):
    id: str
    recibo_id: str
    tipo: str
    email: str
    materiais: list[str] | None
    detalhes: str | None
    status: str
    comprovativo_url: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
