from pydantic import BaseModel, Field


class AvatarUploadPedido(BaseModel):
    content_type: str = Field(min_length=1, max_length=100)


class AvatarUploadPreparado(BaseModel):
    url_de_upload: str
    chave: str
    url_publico: str


class AvatarConfirmar(BaseModel):
    chave: str = Field(min_length=1, max_length=300)


class AvatarConfirmado(BaseModel):
    avatar_url: str


class ComprovativoUploadPedido(BaseModel):
    content_type: str = Field(min_length=1, max_length=100)


class ComprovativoUploadPreparado(BaseModel):
    url_de_upload: str
    chave: str
    url_publico: str
