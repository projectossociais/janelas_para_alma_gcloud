from pydantic import BaseModel


class EliminacoesProcessadas(BaseModel):
    contas_anonimizadas: int
