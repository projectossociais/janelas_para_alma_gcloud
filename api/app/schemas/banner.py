from datetime import datetime

from pydantic import BaseModel


class BannerPublico(BaseModel):
    id: str
    titulo: str
    mensagem: str
    link: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
