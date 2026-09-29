"""Partilhas do relatório dos exercícios com o médico (Fase B).

Só acesso a dados: quem pode criar, ver ou revogar, e quanto tempo vale um
link, é decidido pelo `PartilhaRelatorioService`.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.repositories.orm_models import PartilhaRelatorio, Utilizador


@dataclass(frozen=True)
class PartilhaRegisto:
    id: str
    utilizador_id: str
    criado_em: datetime
    expira_em: datetime
    revogado_em: datetime | None


@dataclass(frozen=True)
class DonoDoRelatorio:
    """O mínimo que o médico precisa de ver -- nunca email nem contactos."""

    utilizador_id: str
    nome: str | None
    olho_mais_fraco: str | None
    usa_oculos: bool | None


class PartilhaRelatorioRepository(Protocol):
    def criar(self, utilizador_id: str, token_hash: str, expira_em: datetime) -> PartilhaRegisto: ...
    def contar_activas(self, utilizador_id: str, agora: datetime) -> int: ...
    def listar_do_utilizador(self, utilizador_id: str) -> list[PartilhaRegisto]: ...
    def revogar(self, partilha_id: str, utilizador_id: str, agora: datetime) -> bool: ...
    def obter_por_hash(self, token_hash: str) -> PartilhaRegisto | None: ...
    def obter_dono(self, utilizador_id: str) -> DonoDoRelatorio | None: ...


def _registo(row: PartilhaRelatorio) -> PartilhaRegisto:
    return PartilhaRegisto(
        id=str(row.id),
        utilizador_id=str(row.utilizador_id),
        criado_em=row.criado_em,
        expira_em=row.expira_em,
        revogado_em=row.revogado_em,
    )


class SQLAlchemyPartilhaRelatorioRepository:
    def __init__(self, sessao: Session) -> None:
        self._sessao = sessao

    def criar(self, utilizador_id: str, token_hash: str, expira_em: datetime) -> PartilhaRegisto:
        row = PartilhaRelatorio(utilizador_id=uuid.UUID(utilizador_id), token_hash=token_hash, expira_em=expira_em)
        self._sessao.add(row)
        self._sessao.commit()
        self._sessao.refresh(row)
        return _registo(row)

    def contar_activas(self, utilizador_id: str, agora: datetime) -> int:
        return self._sessao.scalar(
            select(func.count())
            .select_from(PartilhaRelatorio)
            .where(
                PartilhaRelatorio.utilizador_id == uuid.UUID(utilizador_id),
                PartilhaRelatorio.revogado_em.is_(None),
                PartilhaRelatorio.expira_em > agora,
            )
        ) or 0

    def listar_do_utilizador(self, utilizador_id: str) -> list[PartilhaRegisto]:
        linhas = self._sessao.scalars(
            select(PartilhaRelatorio)
            .where(PartilhaRelatorio.utilizador_id == uuid.UUID(utilizador_id))
            .order_by(PartilhaRelatorio.criado_em.desc())
        ).all()
        return [_registo(r) for r in linhas]

    def revogar(self, partilha_id: str, utilizador_id: str, agora: datetime) -> bool:
        """Só o dono revoga; `False` se não for dele ou não existir."""
        try:
            pid = uuid.UUID(partilha_id)
        except ValueError:
            return False
        resultado = self._sessao.execute(
            update(PartilhaRelatorio)
            .where(
                PartilhaRelatorio.id == pid,
                PartilhaRelatorio.utilizador_id == uuid.UUID(utilizador_id),
                PartilhaRelatorio.revogado_em.is_(None),
            )
            .values(revogado_em=agora)
        )
        self._sessao.commit()
        if resultado.rowcount:
            return True
        # Já revogada antes (idempotente) vs. não é dele / não existe.
        return (
            self._sessao.scalar(
                select(func.count())
                .select_from(PartilhaRelatorio)
                .where(PartilhaRelatorio.id == pid, PartilhaRelatorio.utilizador_id == uuid.UUID(utilizador_id))
            )
            or 0
        ) > 0

    def obter_por_hash(self, token_hash: str) -> PartilhaRegisto | None:
        row = self._sessao.scalar(select(PartilhaRelatorio).where(PartilhaRelatorio.token_hash == token_hash))
        return _registo(row) if row else None

    def obter_dono(self, utilizador_id: str) -> DonoDoRelatorio | None:
        u = self._sessao.get(Utilizador, uuid.UUID(utilizador_id))
        if u is None or u.anonimizado_em is not None:
            return None
        return DonoDoRelatorio(
            utilizador_id=str(u.id), nome=u.nome_completo, olho_mais_fraco=u.olho_mais_fraco, usa_oculos=u.usa_oculos
        )
