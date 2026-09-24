"""Acesso a dados do Mercado do jogo "Inclusivamente" -- bloqueios (cooldown)
dos vendedores ambulantes e débito de diamantes.

Quanto custa, quanto tempo bloqueia e o que o vendedor responde é decidido
em `services/mercado_jogo_service.py`. Aqui só se garante que a compra é
**atómica**: bloquear o vendedor e debitar os diamantes acontecem na mesma
transacção, ou nenhum dos dois. Sem isto, dois pedidos simultâneos podiam
comprar duas vezes ao mesmo vendedor, ou deixar o saldo negativo.
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Literal, Protocol

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.repositories.orm_models import BloqueioVendedorJogo, PerfilJogador
from app.repositories.perfil_jogador_repository import PerfilJogadorRegisto, _para_registo


@dataclass(frozen=True)
class ResultadoDebito:
    estado: Literal["ok", "em_bloqueio", "saldo_insuficiente"]
    # Preenchido com "ok": o perfil já com os diamantes debitados.
    perfil: PerfilJogadorRegisto | None = None
    # Preenchido com "em_bloqueio": até quando o vendedor continua bloqueado.
    disponivel_em: datetime | None = None


class MercadoJogoRepository(Protocol):
    def listar_bloqueios(self, utilizador_id: str) -> dict[str, datetime]: ...
    def debitar_e_bloquear(
        self, utilizador_id: str, vendedor_id: str, custo: int, agora: datetime, disponivel_em: datetime
    ) -> ResultadoDebito: ...


class SQLAlchemyMercadoJogoRepository:
    def __init__(self, sessao: Session) -> None:
        self._sessao = sessao

    def listar_bloqueios(self, utilizador_id: str) -> dict[str, datetime]:
        linhas = self._sessao.scalars(
            select(BloqueioVendedorJogo).where(BloqueioVendedorJogo.utilizador_id == uuid.UUID(utilizador_id))
        ).all()
        return {linha.vendedor_id: linha.disponivel_em for linha in linhas}

    def debitar_e_bloquear(
        self, utilizador_id: str, vendedor_id: str, custo: int, agora: datetime, disponivel_em: datetime
    ) -> ResultadoDebito:
        uid = uuid.UUID(utilizador_id)
        try:
            # 1. Bloqueio condicional: cria a linha, ou renova-a só se o
            #    bloqueio anterior já acabou. Um segundo pedido simultâneo
            #    espera pelo lock desta linha e depois já vê o bloqueio novo
            #    -- o `WHERE` falha e não devolve nada.
            tabela = BloqueioVendedorJogo.__table__
            instrucao = (
                insert(tabela)
                .values(utilizador_id=uid, vendedor_id=vendedor_id, disponivel_em=disponivel_em)
                .on_conflict_do_update(
                    constraint="uq_bloqueios_vendedores_jogo_utilizador_vendedor",
                    set_={"disponivel_em": disponivel_em, "updated_at": agora},
                    where=tabela.c.disponivel_em <= agora,
                )
                .returning(tabela.c.id)
            )
            if self._sessao.execute(instrucao).first() is None:
                self._sessao.rollback()
                atual = self._sessao.scalars(
                    select(BloqueioVendedorJogo.disponivel_em).where(
                        BloqueioVendedorJogo.utilizador_id == uid,
                        BloqueioVendedorJogo.vendedor_id == vendedor_id,
                    )
                ).first()
                return ResultadoDebito(estado="em_bloqueio", disponivel_em=atual)

            # 2. Débito condicional -- nunca deixa o saldo abaixo de zero.
            #    Sem perfil de jogo ainda, não há linha e conta como saldo 0.
            debitado = self._sessao.execute(
                update(PerfilJogador)
                .where(PerfilJogador.utilizador_id == uid, PerfilJogador.diamantes >= custo)
                .values(diamantes=PerfilJogador.diamantes - custo, updated_at=datetime.now(UTC))
                .returning(PerfilJogador.id)
            ).first()
            if debitado is None:
                # Desfaz também o bloqueio do passo 1.
                self._sessao.rollback()
                return ResultadoDebito(estado="saldo_insuficiente")

            self._sessao.commit()
        except Exception:
            self._sessao.rollback()
            raise

        perfil = self._sessao.scalars(select(PerfilJogador).where(PerfilJogador.utilizador_id == uid)).one()
        self._sessao.refresh(perfil)
        return ResultadoDebito(estado="ok", perfil=_para_registo(perfil))
