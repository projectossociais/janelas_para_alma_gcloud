from pydantic import BaseModel


class NumerosImpacto(BaseModel):
    rastreios: int
    sessoes_treino: int
    encaminhamentos: int

    model_config = {"from_attributes": True}
