"""Acesso a dados do horário semanal recorrente de uma clínica.

Ver `orm_models.DisponibilidadeClinica` para a convenção de `dia_semana`
(`date.weekday()` do Python: 0 = segunda, 6 = domingo).
"""

import uuid
from dataclasses import dataclass
from datetime import datetime, time
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.repositories.orm_models import DisponibilidadeClinica


@dataclass(frozen=True)
class DisponibilidadeRegisto:
    id: str
    clinica_id: str
    dia_semana: int
    hora_inicio: time
    hora_fim: time
    modalidade: str
    created_at: datetime


class DisponibilidadeClinicaRepository(Protocol):
    def criar(
        self, clinica_id: str, dia_semana: int, hora_inicio: time, hora_fim: time, modalidade: str
    ) -> DisponibilidadeRegisto: ...
    def listar_por_clinica(self, clinica_id: str) -> list[DisponibilidadeRegisto]: ...
    def remover(self, disponibilidade_id: str, clinica_id: str) -> bool: ...


def _para_registo(row: DisponibilidadeClinica) -> DisponibilidadeRegisto:
    return DisponibilidadeRegisto(
        id=str(row.id),
        clinica_id=str(row.clinica_id),
        dia_semana=row.dia_semana,
        hora_inicio=row.hora_inicio,
        hora_fim=row.hora_fim,
        modalidade=row.modalidade,
        created_at=row.created_at,
    )


class SQLAlchemyDisponibilidadeClinicaRepository:
    def __init__(self, sessao: Session) -> None:
        self._sessao = sessao

    def criar(
        self, clinica_id: str, dia_semana: int, hora_inicio: time, hora_fim: time, modalidade: str
    ) -> DisponibilidadeRegisto:
        row = DisponibilidadeClinica(
            clinica_id=uuid.UUID(clinica_id),
            dia_semana=dia_semana,
            hora_inicio=hora_inicio,
            hora_fim=hora_fim,
            modalidade=modalidade,
        )
        self._sessao.add(row)
        self._sessao.commit()
        self._sessao.refresh(row)
        return _para_registo(row)

    def listar_por_clinica(self, clinica_id: str) -> list[DisponibilidadeRegisto]:
        linhas = self._sessao.scalars(
            select(DisponibilidadeClinica)
            .where(DisponibilidadeClinica.clinica_id == uuid.UUID(clinica_id))
            .order_by(DisponibilidadeClinica.dia_semana, DisponibilidadeClinica.hora_inicio)
        ).all()
        return [_para_registo(r) for r in linhas]

    def remover(self, disponibilidade_id: str, clinica_id: str) -> bool:
        row = self._sessao.get(DisponibilidadeClinica, uuid.UUID(disponibilidade_id))
        if row is None or str(row.clinica_id) != clinica_id:
            return False
        self._sessao.delete(row)
        self._sessao.commit()
        return True
