"""Acesso a dados dos pedidos de consulta clínica.

Ao contrário da candidatura de voluntariado, não há sessão obrigatória --
`nome`/`email`/`telefone` guardam-se sempre directamente no pedido (mesmo
padrão de `Doacao.email`), nunca dependentes de um join a `Utilizador`.
"""

import uuid
from dataclasses import dataclass
from datetime import date, datetime
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.repositories.orm_models import AgendamentoClinico


@dataclass(frozen=True)
class AgendamentoClinicoRegisto:
    id: str
    clinica_id: str
    utilizador_id: str | None
    screening_id: str | None
    nome: str
    email: str
    telefone: str
    modalidade: str
    data_preferida: date | None
    periodo_preferido: str | None
    motivo: str | None
    estado: str
    decidido_por: str | None
    decidido_em: datetime | None
    created_at: datetime


class AgendamentoClinicoRepository(Protocol):
    def criar(
        self,
        clinica_id: str,
        utilizador_id: str | None,
        screening_id: str | None,
        nome: str,
        email: str,
        telefone: str,
        modalidade: str,
        data_preferida: date | None,
        periodo_preferido: str | None,
        motivo: str | None,
    ) -> AgendamentoClinicoRegisto: ...
    def obter(self, agendamento_id: str) -> AgendamentoClinicoRegisto | None: ...
    def listar(self) -> list[AgendamentoClinicoRegisto]: ...
    def confirmar(self, agendamento_id: str, admin_id: str, quando: datetime) -> AgendamentoClinicoRegisto: ...
    def recusar(self, agendamento_id: str, admin_id: str, quando: datetime) -> AgendamentoClinicoRegisto: ...


def _para_registo(row: AgendamentoClinico) -> AgendamentoClinicoRegisto:
    return AgendamentoClinicoRegisto(
        id=str(row.id),
        clinica_id=str(row.clinica_id),
        utilizador_id=str(row.utilizador_id) if row.utilizador_id else None,
        screening_id=str(row.screening_id) if row.screening_id else None,
        nome=row.nome,
        email=row.email,
        telefone=row.telefone,
        modalidade=row.modalidade,
        data_preferida=row.data_preferida,
        periodo_preferido=row.periodo_preferido,
        motivo=row.motivo,
        estado=row.estado,
        decidido_por=str(row.decidido_por) if row.decidido_por else None,
        decidido_em=row.decidido_em,
        created_at=row.created_at,
    )


class SQLAlchemyAgendamentoClinicoRepository:
    def __init__(self, sessao: Session) -> None:
        self._sessao = sessao

    def criar(
        self,
        clinica_id: str,
        utilizador_id: str | None,
        screening_id: str | None,
        nome: str,
        email: str,
        telefone: str,
        modalidade: str,
        data_preferida: date | None,
        periodo_preferido: str | None,
        motivo: str | None,
    ) -> AgendamentoClinicoRegisto:
        row = AgendamentoClinico(
            clinica_id=uuid.UUID(clinica_id),
            utilizador_id=uuid.UUID(utilizador_id) if utilizador_id else None,
            screening_id=uuid.UUID(screening_id) if screening_id else None,
            nome=nome,
            email=email,
            telefone=telefone,
            modalidade=modalidade,
            data_preferida=data_preferida,
            periodo_preferido=periodo_preferido,
            motivo=motivo,
            estado="pendente",
        )
        self._sessao.add(row)
        self._sessao.commit()
        self._sessao.refresh(row)
        return _para_registo(row)

    def obter(self, agendamento_id: str) -> AgendamentoClinicoRegisto | None:
        row = self._sessao.get(AgendamentoClinico, uuid.UUID(agendamento_id))
        return _para_registo(row) if row is not None else None

    def listar(self) -> list[AgendamentoClinicoRegisto]:
        linhas = self._sessao.scalars(
            select(AgendamentoClinico).order_by(AgendamentoClinico.created_at.desc())
        ).all()
        return [_para_registo(r) for r in linhas]

    def confirmar(self, agendamento_id: str, admin_id: str, quando: datetime) -> AgendamentoClinicoRegisto:
        row = self._sessao.get(AgendamentoClinico, uuid.UUID(agendamento_id))
        row.estado = "confirmada"
        row.decidido_por = uuid.UUID(admin_id)
        row.decidido_em = quando
        self._sessao.commit()
        self._sessao.refresh(row)
        return _para_registo(row)

    def recusar(self, agendamento_id: str, admin_id: str, quando: datetime) -> AgendamentoClinicoRegisto:
        row = self._sessao.get(AgendamentoClinico, uuid.UUID(agendamento_id))
        row.estado = "recusada"
        row.decidido_por = uuid.UUID(admin_id)
        row.decidido_em = quando
        self._sessao.commit()
        self._sessao.refresh(row)
        return _para_registo(row)
