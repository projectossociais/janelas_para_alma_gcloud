"""Acesso a dados de `tokens_email` — recuperação de password e confirmação
de conta (ver orm_models.TokenEmail e services/verificacao_email_service.py).

Nunca se guarda o token em bruto, só o `token_hash` -- gerar/comparar o hash
é responsabilidade do service (`_hash_token`), não deste repository.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Literal, Protocol

from sqlalchemy.orm import Session

from app.repositories.orm_models import TokenEmail

TipoToken = Literal["recuperacao_password", "confirmacao_conta"]


@dataclass(frozen=True)
class TokenEmailRegisto:
    id: str
    user_id: str
    tipo: str
    expira_em: datetime
    usado_em: datetime | None


class TokensEmailRepository(Protocol):
    def criar(
        self, user_id: str, tipo: TipoToken, token_hash: str, expira_em: datetime
    ) -> TokenEmailRegisto: ...

    def obter_por_hash(self, token_hash: str) -> TokenEmailRegisto | None: ...

    def marcar_usado(self, token_id: str, quando: datetime) -> None: ...


def _para_registo(row: TokenEmail) -> TokenEmailRegisto:
    return TokenEmailRegisto(
        id=str(row.id),
        user_id=str(row.user_id),
        tipo=row.tipo,
        expira_em=row.expira_em,
        usado_em=row.usado_em,
    )


class SQLAlchemyTokensEmailRepository:
    def __init__(self, sessao: Session) -> None:
        self._sessao = sessao

    def criar(
        self, user_id: str, tipo: TipoToken, token_hash: str, expira_em: datetime
    ) -> TokenEmailRegisto:
        row = TokenEmail(
            user_id=uuid.UUID(user_id), tipo=tipo, token_hash=token_hash, expira_em=expira_em
        )
        self._sessao.add(row)
        self._sessao.commit()
        self._sessao.refresh(row)
        return _para_registo(row)

    def obter_por_hash(self, token_hash: str) -> TokenEmailRegisto | None:
        row = (
            self._sessao.query(TokenEmail)
            .filter(TokenEmail.token_hash == token_hash)
            .one_or_none()
        )
        return _para_registo(row) if row else None

    def marcar_usado(self, token_id: str, quando: datetime) -> None:
        row = self._sessao.get(TokenEmail, uuid.UUID(token_id))
        if row is None:
            return
        row.usado_em = quando
        self._sessao.commit()
