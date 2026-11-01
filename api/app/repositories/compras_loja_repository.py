"""Compras feitas na app nativa (App Store / Google Play): registo + efeito.

As regras (que produto dá o quê, quanto tempo de Premium) vivem no
`CompraLojaService`; aqui só se garante a atomicidade: a linha de
`compras_loja` e o efeito (validade do Premium ou saldo do jogo) gravam-se na
mesma transacção, e o índice único (loja, transacao_id) faz com que o mesmo
webhook repetido -- mesmo em simultâneo -- não aplique nada da segunda vez.
"""

import uuid
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from typing import Literal, Protocol

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.repositories.comprovativos_pagamento_repository import AjustePremium
from app.repositories.orm_models import CompraLoja, PerfilJogador, Utilizador

Loja = Literal["app_store", "play_store"]
TipoCompraLoja = Literal["premium", "diamantes", "moedas"]

# Recebe a validade actual do Premium e os segundos que a compra somou;
# devolve a nova validade (None desliga o Premium).
RetirarPremium = Callable[[datetime | None, int], datetime | None]


@dataclass(frozen=True)
class NovaCompraLoja:
    utilizador_id: str
    loja: Loja
    ambiente: Literal["producao", "sandbox"]
    produto_id: str
    tipo: TipoCompraLoja
    quantidade: int | None
    premium_segundos: int | None
    transacao_id: str
    transacao_original_id: str | None
    comprado_em: datetime


class CompraLojaRepository(Protocol):
    def conta_activa(self, utilizador_id: str) -> bool: ...
    def registar(self, compra: NovaCompraLoja, somar_premium: AjustePremium | None = None) -> bool: ...
    def reembolsar(self, loja: Loja, transacao_id: str, quando: datetime, retirar_premium: RetirarPremium) -> bool: ...


class SQLAlchemyCompraLojaRepository:
    def __init__(self, sessao: Session) -> None:
        self._sessao = sessao

    def conta_activa(self, utilizador_id: str) -> bool:
        """A conta existe e não foi anonimizada (W-03)."""
        try:
            uid = uuid.UUID(utilizador_id)
        except ValueError:
            return False
        return (
            self._sessao.scalar(
                select(Utilizador.id).where(Utilizador.id == uid, Utilizador.anonimizado_em.is_(None))
            )
            is not None
        )

    def _ajustar_premium(self, uid: uuid.UUID, ajustar: AjustePremium) -> None:
        utilizador = self._sessao.scalars(select(Utilizador).where(Utilizador.id == uid).with_for_update()).one()
        actual = utilizador.premium_expira_em if utilizador.premium_ativo else None
        nova = ajustar(actual)
        utilizador.premium_ativo = nova is not None
        utilizador.premium_expira_em = nova

    def registar(self, compra: NovaCompraLoja, somar_premium: AjustePremium | None = None) -> bool:
        """Grava a compra e aplica o efeito, atomicamente. `False` se a
        transacção já tinha sido registada (webhook repetido)."""
        uid = uuid.UUID(compra.utilizador_id)
        try:
            inserida = self._sessao.scalar(
                insert(CompraLoja)
                .values(
                    utilizador_id=uid,
                    loja=compra.loja,
                    ambiente=compra.ambiente,
                    produto_id=compra.produto_id,
                    tipo=compra.tipo,
                    quantidade=compra.quantidade,
                    premium_segundos=compra.premium_segundos,
                    transacao_id=compra.transacao_id,
                    transacao_original_id=compra.transacao_original_id,
                    comprado_em=compra.comprado_em,
                    estado="aplicada",
                )
                .on_conflict_do_nothing(constraint="uq_compras_loja_transacao")
                .returning(CompraLoja.id)
            )
            if inserida is None:
                self._sessao.rollback()
                return False
            if compra.tipo == "premium":
                if somar_premium is None:
                    raise ValueError("compra de Premium sem ajuste da validade")
                self._ajustar_premium(uid, somar_premium)
            else:
                quantidade = compra.quantidade or 0
                coluna = PerfilJogador.moedas if compra.tipo == "moedas" else PerfilJogador.diamantes
                # Cria o perfil do jogo se ainda não existir, e soma num só
                # UPDATE. Moedas compradas não contam para `moedas_ganhas_total`.
                self._sessao.execute(
                    insert(PerfilJogador)
                    .values(
                        utilizador_id=uid,
                        moedas=quantidade if compra.tipo == "moedas" else 0,
                        diamantes=quantidade if compra.tipo == "diamantes" else 0,
                        partidas_jogadas=0,
                        patamar_maximo_alcancado=0,
                    )
                    .on_conflict_do_update(
                        index_elements=[PerfilJogador.utilizador_id],
                        set_={coluna.key: coluna + quantidade, "updated_at": func.now()},
                    )
                )
            self._sessao.commit()
            return True
        except Exception:
            self._sessao.rollback()
            raise

    def reembolsar(self, loja: Loja, transacao_id: str, quando: datetime, retirar_premium: RetirarPremium) -> bool:
        """Marca a compra reembolsada e desfaz o efeito dela, uma única vez.
        `False` se não há compra aplicada com esta transacção."""
        try:
            compra = self._sessao.scalars(
                select(CompraLoja)
                .where(
                    CompraLoja.loja == loja,
                    CompraLoja.transacao_id == transacao_id,
                    CompraLoja.estado == "aplicada",
                )
                .with_for_update()
            ).first()
            if compra is None or compra.utilizador_id is None:
                self._sessao.rollback()
                return False
            compra.estado = "reembolsada"
            compra.reembolsada_em = quando
            if compra.tipo == "premium":
                segundos = compra.premium_segundos or 0
                self._ajustar_premium(compra.utilizador_id, lambda actual: retirar_premium(actual, segundos))
            else:
                # Tira o que a compra deu, sem deixar o saldo negativo (o
                # jogador pode já ter gasto parte).
                coluna = PerfilJogador.moedas if compra.tipo == "moedas" else PerfilJogador.diamantes
                self._sessao.execute(
                    update(PerfilJogador)
                    .where(PerfilJogador.utilizador_id == compra.utilizador_id)
                    .values({coluna.key: func.greatest(coluna - (compra.quantidade or 0), 0), "updated_at": quando})
                )
            self._sessao.commit()
            return True
        except Exception:
            self._sessao.rollback()
            raise
