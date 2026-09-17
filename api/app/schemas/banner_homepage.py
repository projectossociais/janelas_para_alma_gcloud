from datetime import datetime

from pydantic import BaseModel, Field


class BannerHomepagePublico(BaseModel):
    """Forma exposta ao visitante -- sem `ativo` (só o banner activo, já
    com imagem, chega aqui de qualquer forma)."""

    id: str
    titulo: str
    descricao: str | None
    link: str | None
    imagem_url: str | None

    model_config = {"from_attributes": True}


class BannerHomepageAdmin(BannerHomepagePublico):
    """Forma vista no painel de administração -- inclui `ativo` e a data."""

    ativo: bool
    created_at: datetime


class BannerHomepageCriar(BaseModel):
    # Nasce sem imagem -- a foto é sempre um upload em dois passos à parte,
    # depois de o banner já existir (mesmo padrão de Publicacao.capa_url).
    titulo: str = Field(min_length=1, max_length=200)
    descricao: str | None = Field(default=None, max_length=1000)
    link: str | None = Field(default=None, max_length=500)
    ativo: bool = False


class BannerHomepageAtualizar(BaseModel):
    """Todos os campos opcionais -- o que for omitido não muda."""

    titulo: str | None = Field(default=None, min_length=1, max_length=200)
    descricao: str | None = Field(default=None, max_length=1000)
    link: str | None = Field(default=None, max_length=500)
    ativo: bool | None = None


class ImagemUploadPedido(BaseModel):
    content_type: str


class ImagemUploadPreparado(BaseModel):
    url_de_upload: str
    chave: str
    url_publico: str


class ImagemConfirmar(BaseModel):
    chave: str


class ImagemConfirmada(BaseModel):
    imagem_url: str
