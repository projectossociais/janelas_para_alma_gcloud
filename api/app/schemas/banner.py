from datetime import datetime

from pydantic import BaseModel, Field


class BannerPublico(BaseModel):
    """Forma exposta ao visitante — sem `ativo` (só o banner activo chega
    aqui de qualquer forma)."""

    id: str
    titulo: str
    mensagem: str
    link: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class BannerAdmin(BannerPublico):
    """Forma vista no painel de administração — inclui `ativo`."""

    ativo: bool


class BannerCriar(BaseModel):
    titulo: str = Field(min_length=1, max_length=200)
    mensagem: str = Field(min_length=1, max_length=500)
    link: str | None = Field(default=None, max_length=500)
    ativo: bool = True


class BannerAtualizar(BaseModel):
    """Todos os campos opcionais — o que for omitido não muda. `link` a
    `null` explícito não é distinguível de omitido (mesma limitação que
    `PerfilAtualizar`); para hoje, chega."""

    titulo: str | None = Field(default=None, min_length=1, max_length=200)
    mensagem: str | None = Field(default=None, min_length=1, max_length=500)
    link: str | None = Field(default=None, max_length=500)
    ativo: bool | None = None
