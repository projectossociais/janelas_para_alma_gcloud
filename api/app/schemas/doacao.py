from datetime import datetime

from pydantic import BaseModel, EmailStr


class DoacaoMateriaisCriar(BaseModel):
    email: EmailStr
    materiais: list[str]
    detalhes: str | None = None


class DoacaoPublica(BaseModel):
    id: str
    recibo_id: str
    tipo: str
    email: str
    materiais: list[str] | None
    detalhes: str | None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}
