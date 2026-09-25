"""Acesso a dados do ciclo de vida da teleconsulta.

Ver `orm_models.Teleconsulta` -- nasce quando um `AgendamentoClinico` com
`modalidade == "online"` é confirmado, nunca antes.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.repositories.orm_models import Teleconsulta


@dataclass(frozen=True)
class TeleconsultaRegisto:
    id: str
    agendamento_id: str
    sala_video: str
    estado: str
    iniciada_em: datetime | None
    concluida_em: datetime | None
    recomendacao_clinica: str | None
    created_at: datetime


class TeleconsultaRepository(Protocol):
    def criar(self, agendamento_id: str, sala_video: str) -> TeleconsultaRegisto: ...
    def obter_por_agendamento(self, agendamento_id: str) -> TeleconsultaRegisto | None: ...
    def iniciar(self, teleconsulta_id: str, quando: datetime) -> TeleconsultaRegisto: ...
    def concluir(self, teleconsulta_id: str, quando: datetime, recomendacao_clinica: str) -> TeleconsultaRegisto: ...


def _para_registo(row: Teleconsulta) -> TeleconsultaRegisto:
    return TeleconsultaRegisto(
        id=str(row.id),
        agendamento_id=str(row.agendamento_id),
        sala_video=row.sala_video,
        estado=row.estado,
        iniciada_em=row.iniciada_em,
        concluida_em=row.concluida_em,
        recomendacao_clinica=row.recomendacao_clinica,
        created_at=row.created_at,
    )


class SQLAlchemyTeleconsultaRepository:
    def __init__(self, sessao: Session) -> None:
        self._sessao = sessao

    def criar(self, agendamento_id: str, sala_video: str) -> TeleconsultaRegisto:
        row = Teleconsulta(agendamento_id=uuid.UUID(agendamento_id), sala_video=sala_video, estado="agendada")
        self._sessao.add(row)
        self._sessao.commit()
        self._sessao.refresh(row)
        return _para_registo(row)

    def obter_por_agendamento(self, agendamento_id: str) -> TeleconsultaRegisto | None:
        row = self._sessao.scalar(
            select(Teleconsulta).where(Teleconsulta.agendamento_id == uuid.UUID(agendamento_id))
        )
        return _para_registo(row) if row is not None else None

    def iniciar(self, teleconsulta_id: str, quando: datetime) -> TeleconsultaRegisto:
        row = self._sessao.get(Teleconsulta, uuid.UUID(teleconsulta_id))
        row.estado = "em_curso"
        row.iniciada_em = quando
        self._sessao.commit()
        self._sessao.refresh(row)
        return _para_registo(row)

    def concluir(self, teleconsulta_id: str, quando: datetime, recomendacao_clinica: str) -> TeleconsultaRegisto:
        row = self._sessao.get(Teleconsulta, uuid.UUID(teleconsulta_id))
        row.estado = "concluida"
        row.concluida_em = quando
        row.recomendacao_clinica = recomendacao_clinica
        self._sessao.commit()
        self._sessao.refresh(row)
        return _para_registo(row)
