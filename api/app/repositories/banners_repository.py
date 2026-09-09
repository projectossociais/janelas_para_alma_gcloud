"""Leitura pública de banners — sem service de propósito: ler conteúdo
público não decide acesso, dinheiro nem resultado clínico (ver CLAUDE.md,
tabela da secção 3). O router fala directo com este repository.
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.repositories.orm_models import Banner


@dataclass(frozen=True)
class BannerRegisto:
    id: str
    titulo: str
    mensagem: str
    link: str | None
    created_at: datetime


class BannersRepository(Protocol):
    def obter_ativo(self) -> BannerRegisto | None: ...


class SQLAlchemyBannersRepository:
    def __init__(self, sessao: Session) -> None:
        self._sessao = sessao

    def obter_ativo(self) -> BannerRegisto | None:
        row = self._sessao.scalars(
            select(Banner).where(Banner.ativo.is_(True)).order_by(Banner.created_at.desc()).limit(1)
        ).first()
        if row is None:
            return None
        return BannerRegisto(id=str(row.id), titulo=row.titulo, mensagem=row.mensagem, link=row.link, created_at=row.created_at)
