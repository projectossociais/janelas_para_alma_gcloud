from datetime import datetime

from pydantic import BaseModel


class PartilhaRelatorioPublica(BaseModel):
    id: str
    criado_em: datetime
    expira_em: datetime
    revogado_em: datetime | None
    activa: bool


class PartilhaRelatorioCriada(PartilhaRelatorioPublica):
    """Só na criação: o token em claro, uma única vez (guarda-se só o hash)."""

    token: str


class SessaoRelatorio(BaseModel):
    """Sessão tal como o médico a vê: sem ids de utilizador nem detalhes livres."""

    exercicio_id: str
    created_at: datetime
    olho: str | None
    segundos_activos: int | None
    limiar: float | None
    unidade: str | None
    calibrado: bool | None
    sinais: dict | None


class RelatorioPartilhadoPublico(BaseModel):
    nome: str | None
    olho_mais_fraco: str | None
    usa_oculos: bool | None
    expira_em: datetime
    gerado_em: datetime
    sessoes: list[SessaoRelatorio]


