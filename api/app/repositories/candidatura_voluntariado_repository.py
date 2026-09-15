"""Acesso a dados das candidaturas a voluntário.

Mesmo desenho do `premium_repository.py`: `aprovar` toca a candidatura e a
coluna `voluntario_ativo` de `utilizadores` na mesma transacção — os dois
nunca podem ficar dessincronizados. As regras de quando se pode aprovar
vivem no `CandidaturaVoluntariadoService`, testado sem base de dados através
do `Protocol` abaixo.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.repositories.orm_models import CandidaturaVoluntariado, Utilizador


@dataclass(frozen=True)
class CandidaturaVoluntariadoRegisto:
    id: str
    utilizador_id: str
    utilizador_email: str
    utilizador_nome: str | None
    motivacao: str
    telefone: str | None
    status: str
    decidido_por: str | None
    decidido_em: datetime | None
    created_at: datetime


class CandidaturaVoluntariadoRepository(Protocol):
    def criar(self, utilizador_id: str, motivacao: str, telefone: str | None) -> CandidaturaVoluntariadoRegisto: ...
    def obter(self, candidatura_id: str) -> CandidaturaVoluntariadoRegisto | None: ...
    def obter_por_utilizador(self, utilizador_id: str) -> CandidaturaVoluntariadoRegisto | None: ...
    def listar(self) -> list[CandidaturaVoluntariadoRegisto]: ...
    def aprovar(
        self, candidatura_id: str, admin_id: str, quando: datetime
    ) -> CandidaturaVoluntariadoRegisto: ...
    def rejeitar(
        self, candidatura_id: str, admin_id: str, quando: datetime
    ) -> CandidaturaVoluntariadoRegisto: ...


class SQLAlchemyCandidaturaVoluntariadoRepository:
    def __init__(self, sessao: Session) -> None:
        self._sessao = sessao

    def _para_registo(self, row: CandidaturaVoluntariado) -> CandidaturaVoluntariadoRegisto:
        utilizador = self._sessao.get(Utilizador, row.utilizador_id)
        return CandidaturaVoluntariadoRegisto(
            id=str(row.id),
            utilizador_id=str(row.utilizador_id),
            utilizador_email=utilizador.email if utilizador else "",
            utilizador_nome=utilizador.nome_completo if utilizador else None,
            motivacao=row.motivacao,
            telefone=row.telefone,
            status=row.status,
            decidido_por=str(row.decidido_por) if row.decidido_por else None,
            decidido_em=row.decidido_em,
            created_at=row.created_at,
        )

    def criar(
        self, utilizador_id: str, motivacao: str, telefone: str | None
    ) -> CandidaturaVoluntariadoRegisto:
        row = CandidaturaVoluntariado(
            utilizador_id=uuid.UUID(utilizador_id),
            motivacao=motivacao,
            telefone=telefone,
            status="pendente",
        )
        self._sessao.add(row)
        self._sessao.commit()
        self._sessao.refresh(row)
        return self._para_registo(row)

    def obter(self, candidatura_id: str) -> CandidaturaVoluntariadoRegisto | None:
        row = self._sessao.get(CandidaturaVoluntariado, uuid.UUID(candidatura_id))
        return self._para_registo(row) if row else None

    def obter_por_utilizador(self, utilizador_id: str) -> CandidaturaVoluntariadoRegisto | None:
        row = self._sessao.scalars(
            select(CandidaturaVoluntariado)
            .where(CandidaturaVoluntariado.utilizador_id == uuid.UUID(utilizador_id))
            .order_by(CandidaturaVoluntariado.created_at.desc())
        ).first()
        return self._para_registo(row) if row else None

    def listar(self) -> list[CandidaturaVoluntariadoRegisto]:
        linhas = self._sessao.scalars(
            select(CandidaturaVoluntariado).order_by(CandidaturaVoluntariado.created_at.desc())
        ).all()
        return [self._para_registo(linha) for linha in linhas]

    def aprovar(
        self, candidatura_id: str, admin_id: str, quando: datetime
    ) -> CandidaturaVoluntariadoRegisto:
        row = self._sessao.get(CandidaturaVoluntariado, uuid.UUID(candidatura_id))
        utilizador = self._sessao.get(Utilizador, row.utilizador_id)
        utilizador.voluntario_ativo = True
        row.status = "aprovada"
        row.decidido_por = uuid.UUID(admin_id)
        row.decidido_em = quando
        self._sessao.commit()
        self._sessao.refresh(row)
        return self._para_registo(row)

    def rejeitar(
        self, candidatura_id: str, admin_id: str, quando: datetime
    ) -> CandidaturaVoluntariadoRegisto:
        row = self._sessao.get(CandidaturaVoluntariado, uuid.UUID(candidatura_id))
        row.status = "rejeitada"
        row.decidido_por = uuid.UUID(admin_id)
        row.decidido_em = quando
        self._sessao.commit()
        self._sessao.refresh(row)
        return self._para_registo(row)
