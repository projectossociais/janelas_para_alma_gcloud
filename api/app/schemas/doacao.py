from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, EmailStr, Field


class DoacaoMateriaisCriar(BaseModel):
    email: EmailStr
    # Um texto por item, já legível ("Armações: Lentes soltas") -- é o que
    # fica no registo e vai no aviso à equipa. Limites só contra abuso.
    materiais: list[Annotated[str, Field(min_length=1, max_length=200)]] = Field(max_length=40)
    # UX-03 -- onde a equipa vai recolher o que foi doado. Só faz sentido
    # aqui (doação financeira não tem nada para ir buscar).
    provincia: str = Field(min_length=1, max_length=60)
    detalhes: str | None = None


class DoacaoFinanceiraCriar(BaseModel):
    email: EmailStr
    detalhes: str | None = Field(default=None, max_length=1000)
    # "mensal" é um compromisso: o site não cobra cartões, o doador cria uma
    # transferência permanente no banco. Não tem coluna própria -- o frontend
    # já escreve a frequência em `detalhes`; aqui só muda o email e o aviso.
    frequencia: Literal["unica", "mensal"] = "unica"
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
    provincia: str | None
    status: str
    comprovativo_url: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
