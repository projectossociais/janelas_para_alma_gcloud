from datetime import datetime

from pydantic import BaseModel, EmailStr


class AdminUtilizadorPublico(BaseModel):
    id: str
    email: str
    nome_completo: str | None
    papel: str
    premium_ativo: bool
    criado_em: datetime

    model_config = {"from_attributes": True}


class PromoverAdmin(BaseModel):
    email: EmailStr
