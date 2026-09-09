"""Acesso a dados de doações. Ver services/doacao_service.py para a regra
mais importante deste ficheiro inteiro: nunca fingir sucesso quando isto
falha — foi exactamente esse o bug mais grave que o projecto já teve.
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from sqlalchemy.orm import Session

from app.repositories.orm_models import Doacao


@dataclass(frozen=True)
class DoacaoRegisto:
    id: str
    recibo_id: str
    tipo: str
    email: str
    materiais: list[str] | None
    detalhes: str | None
    status: str
    created_at: datetime


class DoacoesRepository(Protocol):
    def criar(
        self,
        recibo_id: str,
        tipo: str,
        email: str,
        status: str,
        materiais: list[str] | None = None,
        detalhes: str | None = None,
    ) -> DoacaoRegisto: ...


class SQLAlchemyDoacoesRepository:
    def __init__(self, sessao: Session) -> None:
        self._sessao = sessao

    def criar(
        self,
        recibo_id: str,
        tipo: str,
        email: str,
        status: str,
        materiais: list[str] | None = None,
        detalhes: str | None = None,
    ) -> DoacaoRegisto:
        row = Doacao(
            recibo_id=recibo_id,
            tipo=tipo,
            email=email,
            materiais=materiais,
            detalhes=detalhes,
            status=status,
        )
        self._sessao.add(row)
        # Se isto falhar (constraint, ligação perdida, o que for), a
        # excepção do SQLAlchemy propaga tal e qual — nunca é apanhada aqui
        # para devolver um "sucesso" fabricado. Ver DoacaoService.
        self._sessao.commit()
        self._sessao.refresh(row)
        return DoacaoRegisto(
            id=str(row.id),
            recibo_id=row.recibo_id,
            tipo=row.tipo,
            email=row.email,
            materiais=row.materiais,
            detalhes=row.detalhes,
            status=row.status,
            created_at=row.created_at,
        )
