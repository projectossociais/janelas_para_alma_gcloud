"""Acesso a dados dos pedidos de diamantes pagos em Kwanzas.

As transições são condicionais e atómicas (`WHERE estado = 'pendente'`):
aprovar duas vezes -- dois admins ao mesmo tempo, ou um duplo clique -- nunca
credita duas vezes, e aprovar credita os diamantes na mesma transacção.
Quem decide *se* e *quanto* é sempre o `LojaJogoService`.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.repositories.orm_models import PedidoDiamantes, PerfilJogador
from app.repositories.perfil_jogador_repository import PerfilJogadorRegisto, para_registo


@dataclass(frozen=True)
class PedidoDiamantesRegisto:
    id: str
    utilizador_id: str | None
    pacote_id: str
    diamantes: int
    preco_kz: int
    comprovativo_url: str
    estado: str
    decidido_por: str | None
    decidido_em: datetime | None
    created_at: datetime


@dataclass(frozen=True)
class PedidoAprovado:
    pedido: PedidoDiamantesRegisto
    perfil: PerfilJogadorRegisto


class PedidoDiamantesRepository(Protocol):
    def criar(
        self, utilizador_id: str, pacote_id: str, diamantes: int, preco_kz: int, comprovativo_url: str
    ) -> PedidoDiamantesRegisto: ...
    def obter(self, pedido_id: str) -> PedidoDiamantesRegisto | None: ...
    def listar_do_utilizador(self, utilizador_id: str) -> list[PedidoDiamantesRegisto]: ...
    def listar(self) -> list[PedidoDiamantesRegisto]: ...
    def aprovar_e_creditar(self, pedido_id: str, admin_id: str, quando: datetime) -> PedidoAprovado | None: ...
    def rejeitar(self, pedido_id: str, admin_id: str, quando: datetime) -> PedidoDiamantesRegisto | None: ...


def _para_registo(row: PedidoDiamantes) -> PedidoDiamantesRegisto:
    return PedidoDiamantesRegisto(
        id=str(row.id),
        utilizador_id=str(row.utilizador_id) if row.utilizador_id else None,
        pacote_id=row.pacote_id,
        diamantes=row.diamantes,
        preco_kz=row.preco_kz,
        comprovativo_url=row.comprovativo_url,
        estado=row.estado,
        decidido_por=str(row.decidido_por) if row.decidido_por else None,
        decidido_em=row.decidido_em,
        created_at=row.created_at,
    )


class SQLAlchemyPedidoDiamantesRepository:
    def __init__(self, sessao: Session) -> None:
        self._sessao = sessao

    def criar(
        self, utilizador_id: str, pacote_id: str, diamantes: int, preco_kz: int, comprovativo_url: str
    ) -> PedidoDiamantesRegisto:
        row = PedidoDiamantes(
            utilizador_id=uuid.UUID(utilizador_id),
            pacote_id=pacote_id,
            diamantes=diamantes,
            preco_kz=preco_kz,
            comprovativo_url=comprovativo_url,
            estado="pendente",
        )
        self._sessao.add(row)
        self._sessao.commit()
        self._sessao.refresh(row)
        return _para_registo(row)

    def obter(self, pedido_id: str) -> PedidoDiamantesRegisto | None:
        try:
            chave = uuid.UUID(pedido_id)
        except ValueError:
            return None
        row = self._sessao.get(PedidoDiamantes, chave)
        return _para_registo(row) if row is not None else None

    def listar_do_utilizador(self, utilizador_id: str) -> list[PedidoDiamantesRegisto]:
        rows = self._sessao.scalars(
            select(PedidoDiamantes)
            .where(PedidoDiamantes.utilizador_id == uuid.UUID(utilizador_id))
            .order_by(PedidoDiamantes.created_at.desc())
        ).all()
        return [_para_registo(r) for r in rows]

    def listar(self) -> list[PedidoDiamantesRegisto]:
        rows = self._sessao.scalars(select(PedidoDiamantes).order_by(PedidoDiamantes.created_at.desc())).all()
        return [_para_registo(r) for r in rows]

    def _decidir(self, pedido_id: str, estado: str, admin_id: str, quando: datetime) -> PedidoDiamantes | None:
        """Pendente -> `estado`, só se ainda estiver pendente. Não faz commit."""
        return self._sessao.scalars(
            update(PedidoDiamantes)
            .where(PedidoDiamantes.id == uuid.UUID(pedido_id), PedidoDiamantes.estado == "pendente")
            .values(estado=estado, decidido_por=uuid.UUID(admin_id), decidido_em=quando)
            .returning(PedidoDiamantes)
            .execution_options(populate_existing=True)
        ).first()

    def aprovar_e_creditar(self, pedido_id: str, admin_id: str, quando: datetime) -> PedidoAprovado | None:
        """Marca aprovado e credita os diamantes do pedido -- tudo ou nada.
        `None` se já não estava pendente (ou não tem conta / perfil)."""
        try:
            pedido = self._decidir(pedido_id, "aprovado", admin_id, quando)
            if pedido is None or pedido.utilizador_id is None:
                self._sessao.rollback()
                return None
            registo_pedido = _para_registo(pedido)
            perfil = self._sessao.scalars(
                update(PerfilJogador)
                .where(PerfilJogador.utilizador_id == pedido.utilizador_id)
                .values(diamantes=PerfilJogador.diamantes + pedido.diamantes, updated_at=quando)
                .returning(PerfilJogador)
                .execution_options(populate_existing=True)
            ).first()
            if perfil is None:
                self._sessao.rollback()
                return None
            registo_perfil = para_registo(perfil)
            self._sessao.commit()
        except Exception:
            self._sessao.rollback()
            raise
        return PedidoAprovado(pedido=registo_pedido, perfil=registo_perfil)

    def rejeitar(self, pedido_id: str, admin_id: str, quando: datetime) -> PedidoDiamantesRegisto | None:
        try:
            pedido = self._decidir(pedido_id, "rejeitado", admin_id, quando)
            if pedido is None:
                self._sessao.rollback()
                return None
            registo = _para_registo(pedido)
            self._sessao.commit()
        except Exception:
            self._sessao.rollback()
            raise
        return registo
