"""Bónus de assiduidade dos treinos: registo do dia + crédito no saldo do jogo.

As regras (quanto, quando, marco semanal) vivem no
`BonusAssiduidadeService`; aqui só se garante a atomicidade: o registo do
dia e o crédito em `perfis_jogador` gravam-se na mesma transacção, e a chave
única (utilizador_id, dia) faz com que um segundo pedido no mesmo dia --
mesmo em simultâneo -- não credite nada.
"""

import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.repositories.orm_models import BonusAssiduidadeTreino, PerfilJogador

# Chega para qualquer sequência realista e limita a leitura.
_JANELA_SEQUENCIA_DIAS = 400


class BonusAssiduidadeRepository(Protocol):
    def dias_seguidos_ate(self, utilizador_id: str, dia: date) -> int: ...
    def creditar_dia(self, utilizador_id: str, dia: date, moedas: int, diamantes: int) -> bool: ...


class SQLAlchemyBonusAssiduidadeRepository:
    def __init__(self, sessao: Session) -> None:
        self._sessao = sessao

    def dias_seguidos_ate(self, utilizador_id: str, dia: date) -> int:
        """Dias seguidos com bónus a terminar em `dia` (inclusive); 0 se esse dia não teve."""
        dias = set(
            self._sessao.scalars(
                select(BonusAssiduidadeTreino.dia).where(
                    BonusAssiduidadeTreino.utilizador_id == uuid.UUID(utilizador_id),
                    BonusAssiduidadeTreino.dia <= dia,
                    BonusAssiduidadeTreino.dia > dia - timedelta(days=_JANELA_SEQUENCIA_DIAS),
                )
            ).all()
        )
        n = 0
        while dia - timedelta(days=n) in dias:
            n += 1
        return n

    def creditar_dia(self, utilizador_id: str, dia: date, moedas: int, diamantes: int) -> bool:
        """Regista o dia e credita o saldo, atomicamente. `False` se o dia já tinha bónus."""
        uid = uuid.UUID(utilizador_id)
        try:
            inserido = self._sessao.scalar(
                insert(BonusAssiduidadeTreino)
                .values(utilizador_id=uid, dia=dia, moedas=moedas, diamantes=diamantes)
                .on_conflict_do_nothing(constraint="uq_bonus_assiduidade_utilizador_dia")
                .returning(BonusAssiduidadeTreino.id)
            )
            if inserido is None:
                self._sessao.rollback()
                return False
            # Cria o perfil do jogo se ainda não existir, e soma num só UPDATE.
            self._sessao.execute(
                insert(PerfilJogador)
                .values(
                    utilizador_id=uid,
                    moedas=moedas,
                    diamantes=diamantes,
                    partidas_jogadas=0,
                    patamar_maximo_alcancado=0,
                )
                .on_conflict_do_update(
                    index_elements=[PerfilJogador.utilizador_id],
                    set_={
                        "moedas": PerfilJogador.moedas + moedas,
                        "diamantes": PerfilJogador.diamantes + diamantes,
                        "updated_at": datetime.now(UTC),
                    },
                )
            )
            self._sessao.commit()
            return True
        except Exception:
            self._sessao.rollback()
            raise
