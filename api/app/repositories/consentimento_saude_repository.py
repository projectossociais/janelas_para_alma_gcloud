"""Consentimentos para tratar dados de saúde (Lei 22/11, art. 13.º e 14.º).

Só acesso a dados: que versão conta e quando o consentimento é válido é
decidido pelo `ConsentimentoSaudeService`.
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.repositories.orm_models import ConsentimentoDadosSaude


@dataclass(frozen=True)
class ConsentimentoRegisto:
    id: str
    utilizador_id: str
    versao: str
    declara_maioridade: bool
    representa_menor: bool
    aceite_em: datetime
    revogado_em: datetime | None


class ConsentimentoSaudeRepository(Protocol):
    def criar(
        self, utilizador_id: str, versao: str, declara_maioridade: bool, representa_menor: bool
    ) -> ConsentimentoRegisto: ...

    def obter_activo(self, utilizador_id: str) -> ConsentimentoRegisto | None:
        """O mais recente ainda não revogado, de qualquer versão."""
        ...

    def revogar_activos(self, utilizador_id: str, agora: datetime) -> int: ...


def _registo(row: ConsentimentoDadosSaude) -> ConsentimentoRegisto:
    return ConsentimentoRegisto(
        id=str(row.id),
        utilizador_id=str(row.utilizador_id),
        versao=row.versao,
        declara_maioridade=row.declara_maioridade,
        representa_menor=row.representa_menor,
        aceite_em=row.aceite_em,
        revogado_em=row.revogado_em,
    )


class SQLAlchemyConsentimentoSaudeRepository:
    def __init__(self, sessao: Session) -> None:
        self._sessao = sessao

    def criar(
        self, utilizador_id: str, versao: str, declara_maioridade: bool, representa_menor: bool
    ) -> ConsentimentoRegisto:
        row = ConsentimentoDadosSaude(
            utilizador_id=utilizador_id,
            versao=versao,
            declara_maioridade=declara_maioridade,
            representa_menor=representa_menor,
        )
        self._sessao.add(row)
        self._sessao.commit()
        self._sessao.refresh(row)
        return _registo(row)

    def obter_activo(self, utilizador_id: str) -> ConsentimentoRegisto | None:
        row = self._sessao.scalars(
            select(ConsentimentoDadosSaude)
            .where(
                ConsentimentoDadosSaude.utilizador_id == utilizador_id,
                ConsentimentoDadosSaude.revogado_em.is_(None),
            )
            .order_by(ConsentimentoDadosSaude.aceite_em.desc())
            .limit(1)
        ).first()
        return _registo(row) if row else None

    def revogar_activos(self, utilizador_id: str, agora: datetime) -> int:
        resultado = self._sessao.execute(
            update(ConsentimentoDadosSaude)
            .where(
                ConsentimentoDadosSaude.utilizador_id == utilizador_id,
                ConsentimentoDadosSaude.revogado_em.is_(None),
            )
            .values(revogado_em=agora)
        )
        self._sessao.commit()
        return resultado.rowcount or 0
