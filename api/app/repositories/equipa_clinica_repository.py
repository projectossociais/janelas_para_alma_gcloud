"""Acesso a dados da ligação conta→clínica (`equipa_clinica`).

A única coisa que dá acesso ao portal de uma clínica -- ver
`core/dependencies.py`, `obter_clinica_do_utilizador`. Leitura/escrita
simples: quem decide se uma ligação faz sentido (o email existe? já está
ligado a outra clínica?) é o `EquipaClinicaService`, não este ficheiro.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.repositories.orm_models import EquipaClinica, Utilizador


@dataclass(frozen=True)
class MembroEquipaRegisto:
    id: str
    utilizador_id: str
    utilizador_email: str
    utilizador_nome: str | None
    clinica_id: str
    created_at: datetime


class EquipaClinicaRepository(Protocol):
    def obter_por_utilizador(self, utilizador_id: str) -> MembroEquipaRegisto | None: ...
    def listar_da_clinica(self, clinica_id: str) -> list[MembroEquipaRegisto]: ...
    def criar(self, utilizador_id: str, clinica_id: str) -> MembroEquipaRegisto: ...
    def remover(self, utilizador_id: str, clinica_id: str) -> bool: ...


class SQLAlchemyEquipaClinicaRepository:
    def __init__(self, sessao: Session) -> None:
        self._sessao = sessao

    def _para_registo(self, row: EquipaClinica) -> MembroEquipaRegisto:
        utilizador = self._sessao.get(Utilizador, row.utilizador_id)
        return MembroEquipaRegisto(
            id=str(row.id),
            utilizador_id=str(row.utilizador_id),
            utilizador_email=utilizador.email if utilizador else "",
            utilizador_nome=utilizador.nome_completo if utilizador else None,
            clinica_id=str(row.clinica_id),
            created_at=row.created_at,
        )

    def obter_por_utilizador(self, utilizador_id: str) -> MembroEquipaRegisto | None:
        row = self._sessao.scalars(
            select(EquipaClinica).where(EquipaClinica.utilizador_id == uuid.UUID(utilizador_id))
        ).first()
        return self._para_registo(row) if row is not None else None

    def listar_da_clinica(self, clinica_id: str) -> list[MembroEquipaRegisto]:
        linhas = self._sessao.scalars(
            select(EquipaClinica)
            .where(EquipaClinica.clinica_id == uuid.UUID(clinica_id))
            .order_by(EquipaClinica.created_at)
        ).all()
        return [self._para_registo(r) for r in linhas]

    def criar(self, utilizador_id: str, clinica_id: str) -> MembroEquipaRegisto:
        row = EquipaClinica(utilizador_id=uuid.UUID(utilizador_id), clinica_id=uuid.UUID(clinica_id))
        self._sessao.add(row)
        self._sessao.commit()
        self._sessao.refresh(row)
        return self._para_registo(row)

    def remover(self, utilizador_id: str, clinica_id: str) -> bool:
        row = self._sessao.scalars(
            select(EquipaClinica).where(
                EquipaClinica.utilizador_id == uuid.UUID(utilizador_id),
                EquipaClinica.clinica_id == uuid.UUID(clinica_id),
            )
        ).first()
        if row is None:
            return False
        self._sessao.delete(row)
        self._sessao.commit()
        return True
