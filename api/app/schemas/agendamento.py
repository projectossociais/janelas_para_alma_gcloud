"""Formas dos dados dos pedidos de consulta clínica."""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field

Modalidade = Literal["presencial", "online"]


class HorarioDisponivel(BaseModel):
    """Um horário concreto e livre, calculado a partir da disponibilidade
    semanal da clínica -- nunca aceite como texto livre do browser (ver
    AgendamentoClinicoService.horarios_disponiveis)."""

    inicio: datetime
    fim: datetime


class ClinicaParceiraPublica(BaseModel):
    id: str
    nome: str

    model_config = {"from_attributes": True}


class AgendamentoClinicoCriar(BaseModel):
    """O que o browser envia ao pedir uma consulta. **Sem `utilizador_id`**
    -- quando existe sessão, vem do JWT (CLAUDE.md secção 4.1); sem sessão,
    o pedido continua válido (mesmo padrão de `DoacaoMateriaisCriar`)."""

    clinica_id: str
    nome: str = Field(min_length=1, max_length=100)
    email: EmailStr
    telefone: str = Field(min_length=6, max_length=30)
    modalidade: Modalidade
    # Instante exacto escolhido de entre os devolvidos por
    # GET /clinicas/{id}/horarios -- nunca texto livre (Fase 1, parte 3 do
    # matchmaker). Datas soltas ("data_preferida"/"periodo_preferido") só
    # existem em pedidos antigos, já gravados antes desta fase.
    horario_inicio: datetime
    motivo: str | None = Field(default=None, max_length=500)
    # Quando o pedido parte do ecrã de resultados de um rastreio -- liga o
    # pedido ao screening que o motivou. Sem verificação de posse aqui: é só
    # um encaminhamento, não dados sensíveis novos a expor (ver AgendamentoClinicoService).
    screening_id: str | None = None


class AgendamentoClinicoPublico(BaseModel):
    """Devolvido a quem pediu -- confirma o que foi registado."""

    id: str
    clinica_id: str
    nome: str
    email: str
    telefone: str
    modalidade: str
    data_preferida: date | None
    periodo_preferido: str | None
    horario_inicio: datetime | None
    motivo: str | None
    estado: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AgendamentoClinicoAdmin(AgendamentoClinicoPublico):
    """Visto no painel de administração."""

    utilizador_id: str | None
    screening_id: str | None
    decidido_por: str | None
    decidido_em: datetime | None
