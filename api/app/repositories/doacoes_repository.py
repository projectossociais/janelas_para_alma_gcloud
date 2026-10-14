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
    provincia: str | None
    status: str
    comprovativo_url: str | None
    created_at: datetime
    # `comprovativo_url` só existe em linhas anteriores ao bucket privado
    # (2026-10-14), até serem migradas; as novas guardam só a chave. Nenhum
    # dos dois sai na API -- o admin pede um URL assinado ao abrir.
    comprovativo_chave: str | None = None

    @property
    def tem_comprovativo(self) -> bool:
        return bool(self.comprovativo_chave or self.comprovativo_url)


class DoacoesRepository(Protocol):
    def criar(
        self,
        recibo_id: str,
        tipo: str,
        email: str,
        status: str,
        materiais: list[str] | None = None,
        detalhes: str | None = None,
        provincia: str | None = None,
        comprovativo_chave: str | None = None,
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
        provincia: str | None = None,
        comprovativo_chave: str | None = None,
    ) -> DoacaoRegisto:
        row = Doacao(
            recibo_id=recibo_id,
            tipo=tipo,
            email=email,
            materiais=materiais,
            detalhes=detalhes,
            provincia=provincia,
            status=status,
            comprovativo_chave=comprovativo_chave,
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
            provincia=row.provincia,
            status=row.status,
            comprovativo_url=row.comprovativo_url,
            comprovativo_chave=row.comprovativo_chave,
            created_at=row.created_at,
        )
