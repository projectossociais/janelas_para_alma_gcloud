"""Acesso a dados dos pedidos da loja do jogo pagos em Kwanzas (diamantes
ou moedas, `tipo_item`).

As transições são condicionais e atómicas (`WHERE estado = 'pendente'`):
aprovar duas vezes -- dois admins ao mesmo tempo, ou um duplo clique -- nunca
credita duas vezes, e aprovar credita a quantidade (no saldo do tipo do
item) na mesma transacção.
Quem decide *se* e *quanto* é sempre o `LojaJogoService`.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Literal, Protocol

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.repositories.orm_models import PedidoLojaJogo, PerfilJogador
from app.repositories.perfil_jogador_repository import PerfilJogadorRegisto, para_registo

TipoItemLoja = Literal["diamantes", "moedas"]


@dataclass(frozen=True)
class PedidoLojaRegisto:
    id: str
    utilizador_id: str | None
    tipo_item: TipoItemLoja
    pacote_id: str
    quantidade: int
    preco_kz: int
    comprovativo_url: str
    estado: str
    decidido_por: str | None
    decidido_em: datetime | None
    created_at: datetime


@dataclass(frozen=True)
class PedidoAprovado:
    pedido: PedidoLojaRegisto
    perfil: PerfilJogadorRegisto


class PedidoLojaRepository(Protocol):
    def criar(
        self,
        utilizador_id: str,
        tipo_item: TipoItemLoja,
        pacote_id: str,
        quantidade: int,
        preco_kz: int,
        comprovativo_url: str,
    ) -> PedidoLojaRegisto: ...
    def obter(self, pedido_id: str) -> PedidoLojaRegisto | None: ...
    def listar_do_utilizador(self, utilizador_id: str) -> list[PedidoLojaRegisto]: ...
    def listar(self) -> list[PedidoLojaRegisto]: ...
    def aprovar_e_creditar(self, pedido_id: str, admin_id: str, quando: datetime) -> PedidoAprovado | None: ...
    def rejeitar(self, pedido_id: str, admin_id: str, quando: datetime) -> PedidoLojaRegisto | None: ...


def _para_registo(row: PedidoLojaJogo) -> PedidoLojaRegisto:
    return PedidoLojaRegisto(
        id=str(row.id),
        utilizador_id=str(row.utilizador_id) if row.utilizador_id else None,
        tipo_item=row.tipo_item,  # type: ignore[arg-type]
        pacote_id=row.pacote_id,
        quantidade=row.quantidade,
        preco_kz=row.preco_kz,
        comprovativo_url=row.comprovativo_url,
        estado=row.estado,
        decidido_por=str(row.decidido_por) if row.decidido_por else None,
        decidido_em=row.decidido_em,
        created_at=row.created_at,
    )


class SQLAlchemyPedidoLojaRepository:
    def __init__(self, sessao: Session) -> None:
        self._sessao = sessao

    def criar(
        self,
        utilizador_id: str,
        tipo_item: TipoItemLoja,
        pacote_id: str,
        quantidade: int,
        preco_kz: int,
        comprovativo_url: str,
    ) -> PedidoLojaRegisto:
        row = PedidoLojaJogo(
            utilizador_id=uuid.UUID(utilizador_id),
            tipo_item=tipo_item,
            pacote_id=pacote_id,
            quantidade=quantidade,
            preco_kz=preco_kz,
            comprovativo_url=comprovativo_url,
            estado="pendente",
        )
        self._sessao.add(row)
        self._sessao.commit()
        self._sessao.refresh(row)
        return _para_registo(row)

    def obter(self, pedido_id: str) -> PedidoLojaRegisto | None:
        try:
            chave = uuid.UUID(pedido_id)
        except ValueError:
            return None
        row = self._sessao.get(PedidoLojaJogo, chave)
        return _para_registo(row) if row is not None else None

    def listar_do_utilizador(self, utilizador_id: str) -> list[PedidoLojaRegisto]:
        rows = self._sessao.scalars(
            select(PedidoLojaJogo)
            .where(PedidoLojaJogo.utilizador_id == uuid.UUID(utilizador_id))
            .order_by(PedidoLojaJogo.created_at.desc())
        ).all()
        return [_para_registo(r) for r in rows]

    def listar(self) -> list[PedidoLojaRegisto]:
        rows = self._sessao.scalars(select(PedidoLojaJogo).order_by(PedidoLojaJogo.created_at.desc())).all()
        return [_para_registo(r) for r in rows]

    def _decidir(self, pedido_id: str, estado: str, admin_id: str, quando: datetime) -> PedidoLojaJogo | None:
        """Pendente -> `estado`, só se ainda estiver pendente. Não faz commit."""
        return self._sessao.scalars(
            update(PedidoLojaJogo)
            .where(PedidoLojaJogo.id == uuid.UUID(pedido_id), PedidoLojaJogo.estado == "pendente")
            .values(estado=estado, decidido_por=uuid.UUID(admin_id), decidido_em=quando)
            .returning(PedidoLojaJogo)
            .execution_options(populate_existing=True)
        ).first()

    def aprovar_e_creditar(self, pedido_id: str, admin_id: str, quando: datetime) -> PedidoAprovado | None:
        """Marca aprovado e credita a quantidade do pedido no saldo do seu
        `tipo_item` (diamantes ou moedas) -- tudo ou nada. `None` se já não
        estava pendente (ou não tem conta / perfil). Moedas compradas não
        contam para `moedas_ganhas_total` (nível do jogador): não se ganharam
        a jogar."""
        try:
            pedido = self._decidir(pedido_id, "aprovado", admin_id, quando)
            if pedido is None or pedido.utilizador_id is None:
                self._sessao.rollback()
                return None
            registo_pedido = _para_registo(pedido)
            perfil = self._sessao.scalars(
                update(PerfilJogador)
                .where(PerfilJogador.utilizador_id == pedido.utilizador_id)
                .values(**self._credito(pedido.tipo_item, pedido.quantidade), updated_at=quando)
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

    @staticmethod
    def _credito(tipo_item: str, quantidade: int) -> dict:
        if tipo_item == "moedas":
            return {"moedas": PerfilJogador.moedas + quantidade}
        if tipo_item == "diamantes":
            return {"diamantes": PerfilJogador.diamantes + quantidade}
        raise ValueError(f"tipo de item desconhecido: {tipo_item!r}")

    def rejeitar(self, pedido_id: str, admin_id: str, quando: datetime) -> PedidoLojaRegisto | None:
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
