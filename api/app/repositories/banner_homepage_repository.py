"""Acesso a dados do banner-imagem da homepage.

Mesma lógica de `banners_repository.py`: ler/gerir conteúdo não é regra de
negócio (CLAUDE.md secção 3) -- o que protege a escrita é a dependency
`obter_utilizador_admin` no router, não um service. A única peça com regra
de verdade é a confirmação da imagem (quem podia "mentir" é a chave a
confirmar), por isso essa parte vive em `banner_homepage_upload_service.py`.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.repositories.orm_models import BannerHomepage


@dataclass(frozen=True)
class BannerHomepageRegisto:
    id: str
    titulo: str
    descricao: str | None
    link: str | None
    imagem_url: str | None
    ativo: bool
    created_at: datetime


@dataclass(frozen=True)
class BannerHomepagePatch:
    """`None` significa "não mexer neste campo" -- mesma convenção de
    `BannerPatch`/`PerfilPatch`."""

    titulo: str | None = None
    descricao: str | None = None
    link: str | None = None
    ativo: bool | None = None


class BannerHomepageRepository(Protocol):
    def obter_ativo(self) -> BannerHomepageRegisto | None: ...
    def listar(self) -> list[BannerHomepageRegisto]: ...
    def criar(self, titulo: str, descricao: str | None, link: str | None, ativo: bool) -> BannerHomepageRegisto: ...
    def atualizar(self, banner_id: str, patch: BannerHomepagePatch) -> BannerHomepageRegisto | None: ...
    def apagar(self, banner_id: str) -> bool: ...
    def definir_imagem_url(self, banner_id: str, url: str) -> None: ...


def _para_registo(row: BannerHomepage) -> BannerHomepageRegisto:
    return BannerHomepageRegisto(
        id=str(row.id),
        titulo=row.titulo,
        descricao=row.descricao,
        link=row.link,
        imagem_url=row.imagem_url,
        ativo=bool(row.ativo),
        created_at=row.created_at,
    )


class SQLAlchemyBannerHomepageRepository:
    def __init__(self, sessao: Session) -> None:
        self._sessao = sessao

    def obter_ativo(self) -> BannerHomepageRegisto | None:
        # Só um de cada vez, e só se já tiver imagem -- um banner "ativo"
        # sem foto não devia aparecer na homepage (ver comentário no ORM:
        # a imagem chega sempre depois, por upload à parte).
        row = self._sessao.scalars(
            select(BannerHomepage)
            .where(BannerHomepage.ativo.is_(True), BannerHomepage.imagem_url.is_not(None))
            .order_by(BannerHomepage.created_at.desc())
            .limit(1)
        ).first()
        return _para_registo(row) if row is not None else None

    def listar(self) -> list[BannerHomepageRegisto]:
        linhas = self._sessao.scalars(select(BannerHomepage).order_by(BannerHomepage.created_at.desc())).all()
        return [_para_registo(linha) for linha in linhas]

    def criar(self, titulo: str, descricao: str | None, link: str | None, ativo: bool) -> BannerHomepageRegisto:
        row = BannerHomepage(titulo=titulo, descricao=descricao, link=link, ativo=ativo)
        self._sessao.add(row)
        self._sessao.commit()
        self._sessao.refresh(row)
        return _para_registo(row)

    def atualizar(self, banner_id: str, patch: BannerHomepagePatch) -> BannerHomepageRegisto | None:
        row = self._sessao.get(BannerHomepage, uuid.UUID(banner_id))
        if row is None:
            return None
        for campo, valor in patch.__dict__.items():
            if valor is not None:
                setattr(row, campo, valor)
        self._sessao.commit()
        self._sessao.refresh(row)
        return _para_registo(row)

    def apagar(self, banner_id: str) -> bool:
        row = self._sessao.get(BannerHomepage, uuid.UUID(banner_id))
        if row is None:
            return False
        self._sessao.delete(row)
        self._sessao.commit()
        return True

    def definir_imagem_url(self, banner_id: str, url: str) -> None:
        row = self._sessao.get(BannerHomepage, uuid.UUID(banner_id))
        if row is None:
            return
        row.imagem_url = url
        self._sessao.commit()
