from datetime import datetime

from pydantic import BaseModel, Field


class ApoioMensalCriar(BaseModel):
    # Limites finais decididos no ApoioMensalService; aqui só se recusa o absurdo.
    valor_mensal_kz: int = Field(gt=0, le=100_000_000)


class ComprovativoApoioMensal(BaseModel):
    # Chave devolvida por POST /uploads/comprovativo, depois do PUT ao R2.
    comprovativo_chave: str = Field(min_length=1, max_length=300)


class ApoioMensalPublico(BaseModel):
    id: str
    valor_mensal_kz: int
    estado: str
    criado_em: datetime
    ultimo_comprovativo_em: datetime | None
    meses_com_comprovativo: int
    renovacao_em_falta: bool

    model_config = {"from_attributes": True}
