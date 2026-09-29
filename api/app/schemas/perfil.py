from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

OlhoMaisFraco = Literal["direito", "esquerdo", "nao_sei"]
FaixaEtaria = Literal["ate_5", "6_12", "13_17", "18_39", "40_59", "60_mais"]


class PerfilPublico(BaseModel):
    id: str
    email: str
    papel: str
    nome_completo: str | None = None
    biografia: str | None = None
    telefone: str | None = None
    data_nascimento: date | None = None
    genero: str | None = None
    provincia: str | None = None
    avatar_url: str | None = None
    premium_ativo: bool = False
    premium_expira_em: datetime | None = None
    notificacoes_projetos: bool
    notificacoes_lembretes: bool
    notificacoes_comunidade: bool
    criado_em: datetime
    # Perfil visual dos exercícios sem webcam -- ver orm_models.Utilizador.
    px_por_mm: float | None = None
    olho_mais_fraco: str | None = None
    usa_oculos: bool | None = None
    faixa_etaria: str | None = None

    model_config = {"from_attributes": True}


class PerfilAtualizar(BaseModel):
    """Todos os campos opcionais — PATCH parcial. Um campo omitido não
    muda; enviar uma string vazia limpa-o (ver PerfilRepository.atualizar).
    Nunca inclui `email`, `papel` nem password — não são deste endpoint."""

    nome_completo: str | None = None
    biografia: str | None = None
    telefone: str | None = None
    data_nascimento: date | None = None
    genero: str | None = None
    provincia: str | None = None
    notificacoes_projetos: bool | None = None
    notificacoes_lembretes: bool | None = None
    notificacoes_comunidade: bool | None = None
    px_por_mm: float | None = Field(default=None, ge=0.5, le=50)
    olho_mais_fraco: OlhoMaisFraco | None = None
    usa_oculos: bool | None = None
    faixa_etaria: FaixaEtaria | None = None
