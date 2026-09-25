"""Acesso a dados dos pedidos de consulta clínica.

Ao contrário da candidatura de voluntariado, não há sessão obrigatória --
`nome`/`email`/`telefone` guardam-se sempre directamente no pedido (mesmo
padrão de `Doacao.email`), nunca dependentes de um join a `Utilizador`.

`premium` (Fase 4, Sprint 4) é a única excepção: calculado sempre na leitura
a partir de `Utilizador.premium_ativo`/`premium_expira_em` (nunca guardado no
pedido -- um Premium que expira entre o pedido e a decisão do admin deixa de
ter prioridade, correctamente), mesmo padrão de `acesso_exercicios_service`.
Pedidos anónimos (`utilizador_id is None`) nunca são Premium.
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.repositories.orm_models import AgendamentoClinico, Utilizador


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
    horario_inicio: datetime | None
    motivo: str | None
    estado: str
    premium: bool
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
        horario_inicio: datetime | None,
        motivo: str | None,
    ) -> AgendamentoClinicoRegisto: ...
    def obter(self, agendamento_id: str) -> AgendamentoClinicoRegisto | None: ...
    def listar(self) -> list[AgendamentoClinicoRegisto]: ...
    def confirmar(self, agendamento_id: str, admin_id: str, quando: datetime) -> AgendamentoClinicoRegisto: ...
    def recusar(self, agendamento_id: str, admin_id: str, quando: datetime) -> AgendamentoClinicoRegisto: ...
    def existe_conflito(self, clinica_id: str, horario_inicio: datetime) -> bool: ...


def _esta_premium(utilizador: Utilizador | None) -> bool:
    if utilizador is None or not utilizador.premium_ativo or utilizador.premium_expira_em is None:
        return False
    return utilizador.premium_expira_em > datetime.now(UTC)


def _para_registo(row: AgendamentoClinico, utilizador: Utilizador | None = None) -> AgendamentoClinicoRegisto:
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
        horario_inicio=row.horario_inicio,
        motivo=row.motivo,
        estado=row.estado,
        premium=_esta_premium(utilizador),
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
        horario_inicio: datetime | None,
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
            horario_inicio=horario_inicio,
            motivo=motivo,
            estado="pendente",
        )
        self._sessao.add(row)
        self._sessao.commit()
        self._sessao.refresh(row)
        return _para_registo(row, self._obter_utilizador(row.utilizador_id))

    def _obter_utilizador(self, utilizador_id: uuid.UUID | None) -> Utilizador | None:
        return self._sessao.get(Utilizador, utilizador_id) if utilizador_id else None

    def existe_conflito(self, clinica_id: str, horario_inicio: datetime) -> bool:
        return (
            self._sessao.scalar(
                select(AgendamentoClinico.id).where(
                    AgendamentoClinico.clinica_id == uuid.UUID(clinica_id),
                    AgendamentoClinico.horario_inicio == horario_inicio,
                    AgendamentoClinico.estado.in_(["pendente", "confirmada"]),
                )
            )
            is not None
        )

    def obter(self, agendamento_id: str) -> AgendamentoClinicoRegisto | None:
        row = self._sessao.get(AgendamentoClinico, uuid.UUID(agendamento_id))
        return _para_registo(row, self._obter_utilizador(row.utilizador_id)) if row is not None else None

    def listar(self) -> list[AgendamentoClinicoRegisto]:
        linhas = self._sessao.execute(
            select(AgendamentoClinico, Utilizador)
            .outerjoin(Utilizador, AgendamentoClinico.utilizador_id == Utilizador.id)
            .order_by(AgendamentoClinico.created_at.desc())
        ).all()
        return [_para_registo(r[0], r[1]) for r in linhas]

    def confirmar(self, agendamento_id: str, admin_id: str, quando: datetime) -> AgendamentoClinicoRegisto:
        row = self._sessao.get(AgendamentoClinico, uuid.UUID(agendamento_id))
        row.estado = "confirmada"
        row.decidido_por = uuid.UUID(admin_id)
        row.decidido_em = quando
        self._sessao.commit()
        self._sessao.refresh(row)
        return _para_registo(row, self._obter_utilizador(row.utilizador_id))

    def recusar(self, agendamento_id: str, admin_id: str, quando: datetime) -> AgendamentoClinicoRegisto:
        row = self._sessao.get(AgendamentoClinico, uuid.UUID(agendamento_id))
        row.estado = "recusada"
        row.decidido_por = uuid.UUID(admin_id)
        row.decidido_em = quando
        self._sessao.commit()
        self._sessao.refresh(row)
        return _para_registo(row, self._obter_utilizador(row.utilizador_id))
