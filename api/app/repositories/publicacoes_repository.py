"""Acesso a dados das publicações (ADMIN-03) e da respectiva galeria de
fotos. As regras de negócio (gerar um slug único, confirmar que uma foto
pertence à publicação certa) vivem no `PublicacoesService` — este
repository só sabe ler e escrever."""

import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.repositories.orm_models import MidiaPublicacao, Publicacao


@dataclass(frozen=True)
class MidiaRegisto:
    id: str
    publicacao_id: str
    url: str
    ordem: int


@dataclass(frozen=True)
class PublicacaoRegisto:
    id: str
    slug: str
    titulo: str
    resumo: str
    corpo: str
    local: str | None
    data_evento: date | None
    capa_url: str | None
    estado: str
    criado_por: str | None
    created_at: datetime
    updated_at: datetime
    midias: list[MidiaRegisto]


class PublicacoesRepository(Protocol):
    def criar(
        self,
        slug: str,
        titulo: str,
        resumo: str,
        corpo: str,
        local: str | None,
        data_evento: date | None,
        criado_por: str | None,
    ) -> PublicacaoRegisto: ...
    def obter_por_id(self, publicacao_id: str) -> PublicacaoRegisto | None: ...
    def obter_por_slug(self, slug: str) -> PublicacaoRegisto | None: ...
    def existe_slug(self, slug: str) -> bool: ...
    def listar_publicadas(self) -> list[PublicacaoRegisto]: ...
    def listar_todas(self) -> list[PublicacaoRegisto]: ...
    def atualizar(self, publicacao_id: str, **campos: object) -> PublicacaoRegisto | None: ...
    def definir_estado(self, publicacao_id: str, estado: str) -> PublicacaoRegisto | None: ...
    def apagar(self, publicacao_id: str) -> None: ...
    def definir_capa(self, publicacao_id: str, url: str) -> None: ...
    def adicionar_midia(self, publicacao_id: str, url: str) -> MidiaRegisto: ...
    def remover_midia(self, midia_id: str) -> None: ...


class SQLAlchemyPublicacoesRepository:
    def __init__(self, sessao: Session) -> None:
        self._sessao = sessao

    def _midias_de(self, publicacao_id: uuid.UUID) -> list[MidiaRegisto]:
        linhas = self._sessao.scalars(
            select(MidiaPublicacao)
            .where(MidiaPublicacao.publicacao_id == publicacao_id)
            .order_by(MidiaPublicacao.ordem.asc(), MidiaPublicacao.created_at.asc())
        ).all()
        return [
            MidiaRegisto(id=str(m.id), publicacao_id=str(m.publicacao_id), url=m.url, ordem=m.ordem)
            for m in linhas
        ]

    def _para_registo(self, row: Publicacao) -> PublicacaoRegisto:
        return PublicacaoRegisto(
            id=str(row.id),
            slug=row.slug,
            titulo=row.titulo,
            resumo=row.resumo,
            corpo=row.corpo,
            local=row.local,
            data_evento=row.data_evento,
            capa_url=row.capa_url,
            estado=row.estado,
            criado_por=str(row.criado_por) if row.criado_por else None,
            created_at=row.created_at,
            updated_at=row.updated_at,
            midias=self._midias_de(row.id),
        )

    def criar(
        self,
        slug: str,
        titulo: str,
        resumo: str,
        corpo: str,
        local: str | None,
        data_evento: date | None,
        criado_por: str | None,
    ) -> PublicacaoRegisto:
        row = Publicacao(
            slug=slug,
            titulo=titulo,
            resumo=resumo,
            corpo=corpo,
            local=local,
            data_evento=data_evento,
            estado="rascunho",
            criado_por=uuid.UUID(criado_por) if criado_por else None,
        )
        self._sessao.add(row)
        self._sessao.commit()
        self._sessao.refresh(row)
        return self._para_registo(row)

    def obter_por_id(self, publicacao_id: str) -> PublicacaoRegisto | None:
        row = self._sessao.get(Publicacao, uuid.UUID(publicacao_id))
        return self._para_registo(row) if row else None

    def obter_por_slug(self, slug: str) -> PublicacaoRegisto | None:
        row = self._sessao.scalars(select(Publicacao).where(Publicacao.slug == slug)).first()
        return self._para_registo(row) if row else None

    def existe_slug(self, slug: str) -> bool:
        return self._sessao.scalar(select(Publicacao.id).where(Publicacao.slug == slug)) is not None

    def listar_publicadas(self) -> list[PublicacaoRegisto]:
        linhas = self._sessao.scalars(
            select(Publicacao)
            .where(Publicacao.estado == "publicada")
            .order_by(Publicacao.data_evento.desc().nullslast(), Publicacao.created_at.desc())
        ).all()
        return [self._para_registo(linha) for linha in linhas]

    def listar_todas(self) -> list[PublicacaoRegisto]:
        linhas = self._sessao.scalars(select(Publicacao).order_by(Publicacao.created_at.desc())).all()
        return [self._para_registo(linha) for linha in linhas]

    def atualizar(self, publicacao_id: str, **campos: object) -> PublicacaoRegisto | None:
        row = self._sessao.get(Publicacao, uuid.UUID(publicacao_id))
        if row is None:
            return None
        for nome, valor in campos.items():
            if valor is not None:
                setattr(row, nome, valor)
        row.updated_at = datetime.now(UTC)
        self._sessao.commit()
        self._sessao.refresh(row)
        return self._para_registo(row)

    def definir_estado(self, publicacao_id: str, estado: str) -> PublicacaoRegisto | None:
        row = self._sessao.get(Publicacao, uuid.UUID(publicacao_id))
        if row is None:
            return None
        row.estado = estado
        self._sessao.commit()
        self._sessao.refresh(row)
        return self._para_registo(row)

    def apagar(self, publicacao_id: str) -> None:
        row = self._sessao.get(Publicacao, uuid.UUID(publicacao_id))
        if row is None:
            return
        self._sessao.delete(row)
        self._sessao.commit()

    def definir_capa(self, publicacao_id: str, url: str) -> None:
        row = self._sessao.get(Publicacao, uuid.UUID(publicacao_id))
        if row is None:
            return
        row.capa_url = url
        self._sessao.commit()

    def adicionar_midia(self, publicacao_id: str, url: str) -> MidiaRegisto:
        ordem_atual = self._sessao.scalar(
            select(MidiaPublicacao.ordem)
            .where(MidiaPublicacao.publicacao_id == uuid.UUID(publicacao_id))
            .order_by(MidiaPublicacao.ordem.desc())
        )
        row = MidiaPublicacao(
            publicacao_id=uuid.UUID(publicacao_id),
            url=url,
            ordem=(ordem_atual or 0) + 1,
        )
        self._sessao.add(row)
        self._sessao.commit()
        self._sessao.refresh(row)
        return MidiaRegisto(id=str(row.id), publicacao_id=str(row.publicacao_id), url=row.url, ordem=row.ordem)

    def remover_midia(self, midia_id: str) -> None:
        row = self._sessao.get(MidiaPublicacao, uuid.UUID(midia_id))
        if row is None:
            return
        self._sessao.delete(row)
        self._sessao.commit()
