"""Estatísticas e pendências do painel de administração.

Leitura pura, sem regra de negócio nenhuma que o utilizador possa "mentir"
sobre — por isso vive só ao nível do repository, chamado directamente pelo
router (ver CLAUDE.md secção 3: "ler o meu histórico" é o exemplo dado para
este lado da tabela). Todas as contagens vêm de tabelas que já existem no
Postgres próprio — nenhuma tabela nova precisa de nascer para isto.
"""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Protocol

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.repositories.orm_models import (
    CandidaturaVoluntariado,
    ContactMessage,
    PremiumRequest,
    ScannerAnalysis,
    SessaoExercicio,
    Utilizador,
)

_JANELA_ATIVOS_DIAS = 7


@dataclass(frozen=True)
class SerieDiaRegisto:
    dia: str
    registos: int
    sessoes: int
    pedidos_premium: int


@dataclass(frozen=True)
class EstatisticasRegisto:
    total_utilizadores: int
    novos_utilizadores: int
    utilizadores_ativos_semana: int
    sessoes_exercicio: int
    analises_scanner: int
    pedidos_premium: int
    mensagens_contacto: int
    serie: list[SerieDiaRegisto]


@dataclass(frozen=True)
class PendenciasRegisto:
    pedidos_premium_pendentes: int
    mensagens_por_ler: int
    candidaturas_voluntariado_pendentes: int


class AdminStatsRepository(Protocol):
    def obter_estatisticas(self, desde: datetime, dias: int) -> EstatisticasRegisto: ...
    def obter_pendencias(self) -> PendenciasRegisto: ...


class SQLAlchemyAdminStatsRepository:
    def __init__(self, sessao: Session) -> None:
        self._sessao = sessao

    def _contar(self, modelo, *condicoes) -> int:
        return self._sessao.scalar(select(func.count()).select_from(modelo).where(*condicoes)) or 0

    def _serie_por_dia(self, modelo, coluna_data, desde: datetime) -> dict[str, int]:
        linhas = self._sessao.execute(
            select(func.date(coluna_data), func.count())
            .select_from(modelo)
            .where(coluna_data >= desde)
            .group_by(func.date(coluna_data))
        ).all()
        return {str(dia): contagem for dia, contagem in linhas}

    def obter_estatisticas(self, desde: datetime, dias: int) -> EstatisticasRegisto:
        total_utilizadores = self._contar(Utilizador)
        novos_utilizadores = self._contar(Utilizador, Utilizador.created_at >= desde)
        sete_dias_atras = datetime.now(UTC) - timedelta(days=_JANELA_ATIVOS_DIAS)
        utilizadores_ativos_semana = self._sessao.scalar(
            select(func.count(func.distinct(SessaoExercicio.user_id))).where(
                SessaoExercicio.created_at >= sete_dias_atras
            )
        ) or 0
        sessoes_exercicio = self._contar(SessaoExercicio, SessaoExercicio.created_at >= desde)
        analises_scanner = self._contar(ScannerAnalysis, ScannerAnalysis.created_at >= desde)
        pedidos_premium = self._contar(PremiumRequest, PremiumRequest.created_at >= desde)
        mensagens_contacto = self._contar(ContactMessage, ContactMessage.created_at >= desde)

        registos_por_dia = self._serie_por_dia(Utilizador, Utilizador.created_at, desde)
        sessoes_por_dia = self._serie_por_dia(SessaoExercicio, SessaoExercicio.created_at, desde)
        premium_por_dia = self._serie_por_dia(PremiumRequest, PremiumRequest.created_at, desde)

        serie: list[SerieDiaRegisto] = []
        for i in range(dias - 1, -1, -1):
            dia = (datetime.now(UTC) - timedelta(days=i)).strftime("%Y-%m-%d")
            serie.append(
                SerieDiaRegisto(
                    dia=dia,
                    registos=registos_por_dia.get(dia, 0),
                    sessoes=sessoes_por_dia.get(dia, 0),
                    pedidos_premium=premium_por_dia.get(dia, 0),
                )
            )

        return EstatisticasRegisto(
            total_utilizadores=total_utilizadores,
            novos_utilizadores=novos_utilizadores,
            utilizadores_ativos_semana=utilizadores_ativos_semana,
            sessoes_exercicio=sessoes_exercicio,
            analises_scanner=analises_scanner,
            pedidos_premium=pedidos_premium,
            mensagens_contacto=mensagens_contacto,
            serie=serie,
        )

    def obter_pendencias(self) -> PendenciasRegisto:
        return PendenciasRegisto(
            pedidos_premium_pendentes=self._contar(PremiumRequest, PremiumRequest.status == "pendente"),
            mensagens_por_ler=self._contar(ContactMessage, ContactMessage.lida.is_(False)),
            candidaturas_voluntariado_pendentes=self._contar(
                CandidaturaVoluntariado, CandidaturaVoluntariado.status == "pendente"
            ),
        )
