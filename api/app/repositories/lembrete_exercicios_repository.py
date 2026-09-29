"""Quem recebe o lembrete diário de treino (Fase A, docs/ANALISE_EXERCICIOS.md).

Leitura só -- as regras de *quem* merece lembrete são decididas pelo
`LembreteExerciciosService` e chegam aqui como parâmetros (janela de dias,
ids dos treinos); o repository só as traduz para SQL.
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from sqlalchemy import and_, exists, or_, select
from sqlalchemy.orm import Session

from app.repositories.orm_models import AppRole, SessaoExercicio, Utilizador


@dataclass(frozen=True)
class DestinatarioLembrete:
    id: str
    email: str
    nome: str | None


class LembreteExerciciosRepository(Protocol):
    def listar_destinatarios(
        self,
        agora: datetime,
        inicio_hoje: datetime,
        treinou_desde: datetime,
        ids_treinos: tuple[str, ...],
    ) -> list[DestinatarioLembrete]: ...


class SQLAlchemyLembreteExerciciosRepository:
    def __init__(self, sessao: Session) -> None:
        self._sessao = sessao

    def listar_destinatarios(
        self,
        agora: datetime,
        inicio_hoje: datetime,
        treinou_desde: datetime,
        ids_treinos: tuple[str, ...],
    ) -> list[DestinatarioLembrete]:
        def treino_desde(momento: datetime):
            return exists().where(
                SessaoExercicio.user_id == Utilizador.id,
                SessaoExercicio.exercicio_id.in_(ids_treinos),
                SessaoExercicio.created_at >= momento,
            )

        com_acesso = or_(
            and_(Utilizador.premium_ativo.is_(True), Utilizador.premium_expira_em > agora),
            Utilizador.trial_termina_em > agora,
        )
        linhas = self._sessao.execute(
            select(Utilizador.id, Utilizador.email, Utilizador.nome_completo).where(
                Utilizador.notificacoes_lembretes.is_(True),
                Utilizador.email_confirmado.is_(True),
                Utilizador.anonimizado_em.is_(None),
                Utilizador.papel != AppRole.admin,
                com_acesso,
                treino_desde(treinou_desde),
                ~treino_desde(inicio_hoje),
            )
        ).all()
        return [DestinatarioLembrete(id=str(i), email=e, nome=n) for i, e, n in linhas]
