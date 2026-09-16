from datetime import date, datetime

from pydantic import BaseModel, Field


class PublicacaoCriar(BaseModel):
    titulo: str = Field(min_length=1, max_length=200)
    resumo: str = Field(min_length=1, max_length=500)
    corpo: str = Field(min_length=1, max_length=20000)
    local: str | None = Field(default=None, max_length=200)
    data_evento: date | None = None


class PublicacaoAtualizar(BaseModel):
    titulo: str | None = Field(default=None, min_length=1, max_length=200)
    resumo: str | None = Field(default=None, min_length=1, max_length=500)
    corpo: str | None = Field(default=None, min_length=1, max_length=20000)
    local: str | None = Field(default=None, max_length=200)
    data_evento: date | None = None


class MidiaPublica(BaseModel):
    id: str
    url: str
    ordem: int

    model_config = {"from_attributes": True}


class PublicacaoPublica(BaseModel):
    """Vista pública de uma publicação — usada tanto na lista (`/publicacoes`)
    como no detalhe (`/publicacoes/{slug}`, aí com `midias` preenchido)."""

    id: str
    slug: str
    titulo: str
    resumo: str
    corpo: str
    local: str | None
    data_evento: date | None
    capa_url: str | None
    midias: list[MidiaPublica]

    model_config = {"from_attributes": True}


class PublicacaoAdmin(PublicacaoPublica):
    estado: str
    criado_por: str | None
    created_at: datetime
    updated_at: datetime


class MidiaUploadPedido(BaseModel):
    content_type: str


class MidiaUploadPreparado(BaseModel):
    url_de_upload: str
    chave: str
    url_publico: str


class MidiaConfirmar(BaseModel):
    chave: str


class CapaConfirmada(BaseModel):
    capa_url: str
