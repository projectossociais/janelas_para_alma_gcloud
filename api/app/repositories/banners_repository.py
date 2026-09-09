"""Acesso a dados de banners.

A leitura pública (`obter_ativo`) não tem service de propósito — ler
conteúdo público não decide acesso, dinheiro nem resultado clínico (ver
CLAUDE.md, tabela da secção 3). A escrita (criar/editar/apagar) também não
tem regra de negócio: é gestão de conteúdo. O que a protege é a dependency
`obter_utilizador_admin` no router, não um service. O router fala directo
com este repository nas duas direcções.
"""

import uuid
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
    ativo: bool
    created_at: datetime


@dataclass(frozen=True)
class BannerPatch:
    """Campos a mudar num banner. `None` significa "não mexer neste campo",
    não "pôr a null" — mesma convenção que `PerfilPatch`."""

    titulo: str | None = None
    mensagem: str | None = None
    link: str | None = None
    ativo: bool | None = None


class BannersRepository(Protocol):
    def obter_ativo(self) -> BannerRegisto | None: ...
    def listar(self) -> list[BannerRegisto]: ...
    def criar(self, titulo: str, mensagem: str, link: str | None, ativo: bool) -> BannerRegisto: ...
    def atualizar(self, banner_id: str, patch: BannerPatch) -> BannerRegisto | None: ...
    def apagar(self, banner_id: str) -> bool: ...


def _para_registo(row: Banner) -> BannerRegisto:
    return BannerRegisto(
        id=str(row.id),
        titulo=row.titulo,
        mensagem=row.mensagem,
        link=row.link,
        ativo=bool(row.ativo),
        created_at=row.created_at,
    )


class SQLAlchemyBannersRepository:
    def __init__(self, sessao: Session) -> None:
        self._sessao = sessao

    def obter_ativo(self) -> BannerRegisto | None:
        row = self._sessao.scalars(
            select(Banner).where(Banner.ativo.is_(True)).order_by(Banner.created_at.desc()).limit(1)
        ).first()
        return _para_registo(row) if row is not None else None

    def listar(self) -> list[BannerRegisto]:
        linhas = self._sessao.scalars(select(Banner).order_by(Banner.created_at.desc())).all()
        return [_para_registo(linha) for linha in linhas]

    def criar(self, titulo: str, mensagem: str, link: str | None, ativo: bool) -> BannerRegisto:
        row = Banner(titulo=titulo, mensagem=mensagem, link=link, ativo=ativo)
        self._sessao.add(row)
        self._sessao.commit()
        self._sessao.refresh(row)
        return _para_registo(row)

    def atualizar(self, banner_id: str, patch: BannerPatch) -> BannerRegisto | None:
        row = self._sessao.get(Banner, uuid.UUID(banner_id))
        if row is None:
            return None
        for campo, valor in patch.__dict__.items():
            if valor is not None:
                setattr(row, campo, valor)
        self._sessao.commit()
        self._sessao.refresh(row)
        return _para_registo(row)

    def apagar(self, banner_id: str) -> bool:
        row = self._sessao.get(Banner, uuid.UUID(banner_id))
        if row is None:
            return False
        self._sessao.delete(row)
        self._sessao.commit()
        return True
