from pydantic import BaseModel


class EliminacoesProcessadas(BaseModel):
    contas_anonimizadas: int


class LembretesEnviados(BaseModel):
    enviados: int
    falhados: int
