"""Acesso a dados do direito de acesso aos exercícios — a fatia da tabela
`utilizadores` que decide quem pode fazer que exercício: papel, Premium e
trial de 7 dias. Mesmo desenho de `perfil_repository.py` (repositórios
diferentes, mesma tabela).

A regra em si (quem tem acesso a quê) vive no `AcessoExerciciosService`;
aqui só se lê e grava.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from sqlalchemy import update
from sqlalchemy.orm import Session

from app.repositories.orm_models import Utilizador


@dataclass(frozen=True)
class EstadoAcessoRegisto:
    papel: str
    premium_ativo: bool
    premium_expira_em: datetime | None
    trial_iniciado_em: datetime | None
    trial_termina_em: datetime | None


class AcessoExerciciosRepository(Protocol):
    def obter(self, utilizador_id: str) -> EstadoAcessoRegisto | None: ...

    def iniciar_trial(self, utilizador_id: str, inicio: datetime, fim: datetime) -> bool:
        """Grava o início/fim do trial **só se ainda não tiver sido
        iniciado**. Devolve `False` se já tinha sido (ou se a conta não
        existe) — a condição vive no próprio `UPDATE`, para dois pedidos em
        simultâneo nunca conseguirem iniciar o trial duas vezes."""
        ...


class SQLAlchemyAcessoExerciciosRepository:
    def __init__(self, sessao: Session) -> None:
        self._sessao = sessao

    def obter(self, utilizador_id: str) -> EstadoAcessoRegisto | None:
        row = self._sessao.get(Utilizador, uuid.UUID(utilizador_id))
        if row is None:
            return None
        return EstadoAcessoRegisto(
            papel=row.papel.value,
            premium_ativo=bool(row.premium_ativo),
            premium_expira_em=row.premium_expira_em,
            trial_iniciado_em=row.trial_iniciado_em,
            trial_termina_em=row.trial_termina_em,
        )

    def iniciar_trial(self, utilizador_id: str, inicio: datetime, fim: datetime) -> bool:
        resultado = self._sessao.execute(
            update(Utilizador)
            .where(Utilizador.id == uuid.UUID(utilizador_id))
            .where(Utilizador.trial_iniciado_em.is_(None))
            .values(trial_iniciado_em=inicio, trial_termina_em=fim)
        )
        self._sessao.commit()
        return resultado.rowcount == 1
