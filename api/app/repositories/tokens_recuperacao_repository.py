"""Acesso a dados dos tokens de recuperação de password.

Mesmo padrão de `utilizadores_repository.py`: `TokensRecuperacaoRepository` é
o contrato (Protocol) de que o service depende, não esta implementação — o
que torna `RecuperacaoPasswordService` testável sem base de dados nenhuma.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from sqlalchemy.orm import Session

from app.repositories.orm_models import TokenRecuperacaoPassword


@dataclass(frozen=True)
class TokenRecuperacaoRegisto:
    id: str
    utilizador_id: str
    token_hash: str
    expira_em: datetime
    usado_em: datetime | None


class TokensRecuperacaoRepository(Protocol):
    def criar(self, utilizador_id: str, token_hash: str, expira_em: datetime) -> TokenRecuperacaoRegisto: ...

    def obter_por_hash(self, token_hash: str) -> TokenRecuperacaoRegisto | None: ...

    def marcar_usado(self, token_id: str, quando: datetime) -> None: ...


class SQLAlchemyTokensRecuperacaoRepository:
    """Implementação real, usada pela API. Ver app/db.py para a sessão."""

    def __init__(self, sessao: Session) -> None:
        self._sessao = sessao

    @staticmethod
    def _para_registo(row: TokenRecuperacaoPassword) -> TokenRecuperacaoRegisto:
        return TokenRecuperacaoRegisto(
            id=str(row.id),
            utilizador_id=str(row.utilizador_id),
            token_hash=row.token_hash,
            expira_em=row.expira_em,
            usado_em=row.usado_em,
        )

    def criar(self, utilizador_id: str, token_hash: str, expira_em: datetime) -> TokenRecuperacaoRegisto:
        row = TokenRecuperacaoPassword(
            utilizador_id=uuid.UUID(utilizador_id),
            token_hash=token_hash,
            expira_em=expira_em,
        )
        self._sessao.add(row)
        self._sessao.commit()
        self._sessao.refresh(row)
        return self._para_registo(row)

    def obter_por_hash(self, token_hash: str) -> TokenRecuperacaoRegisto | None:
        row = (
            self._sessao.query(TokenRecuperacaoPassword)
            .filter(TokenRecuperacaoPassword.token_hash == token_hash)
            .one_or_none()
        )
        return self._para_registo(row) if row else None

    def marcar_usado(self, token_id: str, quando: datetime) -> None:
        row = self._sessao.get(TokenRecuperacaoPassword, uuid.UUID(token_id))
        if row is None:
            return
        row.usado_em = quando
        self._sessao.commit()
