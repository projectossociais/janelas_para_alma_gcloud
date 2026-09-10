"""Acesso a dados do Premium — os pedidos (`premium_requests`) e o efeito da
aprovação nas colunas `premium_*` de `utilizadores`.

`aprovar_pagamento` e `revogar` tocam as **duas** tabelas numa só transacção
(um `commit`): o estado do pedido e o acesso do utilizador nunca podem ficar
dessincronizados. As *regras* de quando se pode aprovar (pedido existe, tem
utilizador ligado, ainda não foi aprovado) vivem no `PremiumService`, que
testa isso sem base de dados através do `Protocol` abaixo.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.repositories.orm_models import PremiumRequest, Utilizador


@dataclass(frozen=True)
class PedidoPremiumRegisto:
    id: str
    user_id: str | None
    nome: str
    email: str
    telefone: str | None
    plano: str | None
    status: str
    aprovado_por: str | None
    aprovado_em: datetime | None
    created_at: datetime


class PremiumRepository(Protocol):
    def criar(
        self, nome: str, email: str, telefone: str | None, plano: str | None, user_id: str | None
    ) -> PedidoPremiumRegisto: ...
    def obter(self, pedido_id: str) -> PedidoPremiumRegisto | None: ...
    def listar(self) -> list[PedidoPremiumRegisto]: ...
    def aprovar_pagamento(
        self, pedido_id: str, admin_id: str, quando: datetime, expira_em: datetime
    ) -> PedidoPremiumRegisto: ...
    def revogar(self, pedido_id: str, admin_id: str, quando: datetime) -> PedidoPremiumRegisto: ...


def _para_registo(row: PremiumRequest) -> PedidoPremiumRegisto:
    return PedidoPremiumRegisto(
        id=str(row.id),
        user_id=str(row.user_id) if row.user_id else None,
        nome=row.nome,
        email=row.email,
        telefone=row.telefone,
        plano=row.plano,
        status=row.status or "pendente",
        aprovado_por=str(row.aprovado_por) if row.aprovado_por else None,
        aprovado_em=row.aprovado_em,
        created_at=row.created_at,
    )


class SQLAlchemyPremiumRepository:
    def __init__(self, sessao: Session) -> None:
        self._sessao = sessao

    def criar(
        self, nome: str, email: str, telefone: str | None, plano: str | None, user_id: str | None
    ) -> PedidoPremiumRegisto:
        row = PremiumRequest(
            nome=nome,
            email=email,
            telefone=telefone,
            plano=plano,
            user_id=uuid.UUID(user_id) if user_id else None,
            status="pendente",
        )
        self._sessao.add(row)
        self._sessao.commit()
        self._sessao.refresh(row)
        return _para_registo(row)

    def obter(self, pedido_id: str) -> PedidoPremiumRegisto | None:
        row = self._sessao.get(PremiumRequest, uuid.UUID(pedido_id))
        return _para_registo(row) if row else None

    def listar(self) -> list[PedidoPremiumRegisto]:
        linhas = self._sessao.scalars(
            select(PremiumRequest).order_by(PremiumRequest.created_at.desc())
        ).all()
        return [_para_registo(linha) for linha in linhas]

    def aprovar_pagamento(
        self, pedido_id: str, admin_id: str, quando: datetime, expira_em: datetime
    ) -> PedidoPremiumRegisto:
        pedido = self._sessao.get(PremiumRequest, uuid.UUID(pedido_id))
        utilizador = self._sessao.get(Utilizador, pedido.user_id)
        utilizador.premium_ativo = True
        utilizador.premium_expira_em = expira_em
        pedido.status = "aprovado"
        pedido.aprovado_por = uuid.UUID(admin_id)
        pedido.aprovado_em = quando
        self._sessao.commit()
        self._sessao.refresh(pedido)
        return _para_registo(pedido)

    def revogar(self, pedido_id: str, admin_id: str, quando: datetime) -> PedidoPremiumRegisto:
        pedido = self._sessao.get(PremiumRequest, uuid.UUID(pedido_id))
        if pedido.user_id is not None:
            utilizador = self._sessao.get(Utilizador, pedido.user_id)
            if utilizador is not None:
                utilizador.premium_ativo = False
                utilizador.premium_expira_em = None
        pedido.status = "revogado"
        pedido.aprovado_por = uuid.UUID(admin_id)
        pedido.aprovado_em = quando
        self._sessao.commit()
        self._sessao.refresh(pedido)
        return _para_registo(pedido)
