from datetime import date, datetime

from pydantic import BaseModel


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
    notificacoes_projetos: bool
    notificacoes_lembretes: bool
    notificacoes_comunidade: bool
    criado_em: datetime

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
