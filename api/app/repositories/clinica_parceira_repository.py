"""Acesso a dados das clínicas parceiras -- leitura pura, sem regra de
negócio nenhuma que o utilizador possa "mentir" sobre (CLAUDE.md secção 3),
por isso vive só ao nível do repository."""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.repositories.orm_models import ClinicaParceira


@dataclass(frozen=True)
class ClinicaParceiraRegisto:
    id: str
    nome: str
    email_contacto: str
    telefone_contacto: str
    ativa: bool
    created_at: datetime


class ClinicaParceiraRepository(Protocol):
    def listar_ativas(self) -> list[ClinicaParceiraRegisto]: ...
    def obter(self, clinica_id: str) -> ClinicaParceiraRegisto | None: ...


def _para_registo(row: ClinicaParceira) -> ClinicaParceiraRegisto:
    return ClinicaParceiraRegisto(
        id=str(row.id),
        nome=row.nome,
        email_contacto=row.email_contacto,
        telefone_contacto=row.telefone_contacto,
        ativa=row.ativa,
        created_at=row.created_at,
    )


class SQLAlchemyClinicaParceiraRepository:
    def __init__(self, sessao: Session) -> None:
        self._sessao = sessao

    def listar_ativas(self) -> list[ClinicaParceiraRegisto]:
        linhas = self._sessao.scalars(
            select(ClinicaParceira).where(ClinicaParceira.ativa.is_(True)).order_by(ClinicaParceira.nome)
        ).all()
        return [_para_registo(r) for r in linhas]

    def obter(self, clinica_id: str) -> ClinicaParceiraRegisto | None:
        row = self._sessao.get(ClinicaParceira, uuid.UUID(clinica_id))
        return _para_registo(row) if row is not None else None
