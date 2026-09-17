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


class SessaoExercicioAdmin(BaseModel):
    id: str
    user_id: str
    utilizador_nome: str | None
    utilizador_email: str
    exercicio_id: str
    duracao_segundos: int
    pontuacao: int
    precisao_percentual: float
    created_at: datetime

    model_config = {"from_attributes": True}


class UtilizadorAtivoAdmin(BaseModel):
    user_id: str
    utilizador_nome: str | None
    utilizador_email: str
    sessoes_na_semana: int
    ultima_sessao_em: datetime

    model_config = {"from_attributes": True}
