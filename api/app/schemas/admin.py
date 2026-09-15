from datetime import datetime

from pydantic import BaseModel, EmailStr


class AdminUtilizadorPublico(BaseModel):
    id: str
    email: str
    nome_completo: str | None
    papel: str
    premium_ativo: bool
    criado_em: datetime

    model_config = {"from_attributes": True}


class PromoverAdmin(BaseModel):
    email: EmailStr


class DefinirPapel(BaseModel):
    # "admin" fica de fora de propósito -- promover/despromover admin já tem
    # o seu próprio fluxo, com protecção contra ficar sem nenhum admin (ver
    # AdminService). Nunca duplicar essa lógica aqui.
    papel: str


class SerieDiaAdmin(BaseModel):
    dia: str
    registos: int
    sessoes: int
    pedidos_premium: int


class EstatisticasAdmin(BaseModel):
    total_utilizadores: int
    novos_utilizadores: int
    utilizadores_ativos_semana: int
    sessoes_exercicio: int
    analises_scanner: int
    pedidos_premium: int
    mensagens_contacto: int
    serie: list[SerieDiaAdmin]


class PendenciasAdmin(BaseModel):
    pedidos_premium_pendentes: int
    mensagens_por_ler: int
    candidaturas_voluntariado_pendentes: int
