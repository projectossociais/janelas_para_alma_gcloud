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

_LIMITE_LISTAGEM = 200


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
    utilizadores_ativos_periodo: int
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


@dataclass(frozen=True)
class SessaoExercicioAdminRegisto:
    id: str
    user_id: str
    utilizador_nome: str | None
    utilizador_email: str
    exercicio_id: str
    duracao_segundos: int
    pontuacao: int
    precisao_percentual: float
    created_at: datetime


@dataclass(frozen=True)
class UtilizadorAtivoRegisto:
    user_id: str
    utilizador_nome: str | None
    utilizador_email: str
    sessoes_no_periodo: int
    ultima_sessao_em: datetime


class AdminStatsRepository(Protocol):
    def obter_estatisticas(self, desde: datetime, dias: int) -> EstatisticasRegisto: ...
    def obter_pendencias(self) -> PendenciasRegisto: ...
    def listar_sessoes_exercicio(self, desde: datetime) -> list[SessaoExercicioAdminRegisto]: ...
    def listar_ativos(self, desde: datetime) -> list[UtilizadorAtivoRegisto]: ...


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
        # Mesmo período escolhido no filtro do dashboard (Semanal/Mensal/
        # Anual) -- antes disto era sempre uma janela fixa de 7 dias, por
        # isso este card nunca mudava com o filtro (só o gráfico mudava).
        utilizadores_ativos_periodo = self._sessao.scalar(
            select(func.count(func.distinct(SessaoExercicio.user_id))).where(
                SessaoExercicio.created_at >= desde
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
            utilizadores_ativos_periodo=utilizadores_ativos_periodo,
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

    def listar_sessoes_exercicio(self, desde: datetime) -> list[SessaoExercicioAdminRegisto]:
        linhas = self._sessao.execute(
            select(SessaoExercicio, Utilizador)
            .join(Utilizador, Utilizador.id == SessaoExercicio.user_id)
            .where(SessaoExercicio.created_at >= desde)
            .order_by(SessaoExercicio.created_at.desc())
            .limit(_LIMITE_LISTAGEM)
        ).all()
        return [
            SessaoExercicioAdminRegisto(
                id=str(sessao.id),
                user_id=str(sessao.user_id),
                utilizador_nome=utilizador.nome_completo,
                utilizador_email=utilizador.email,
                exercicio_id=sessao.exercicio_id,
                duracao_segundos=sessao.duracao_segundos,
                pontuacao=sessao.pontuacao,
                precisao_percentual=float(sessao.precisao_percentual),
                created_at=sessao.created_at,
            )
            for sessao, utilizador in linhas
        ]

    def listar_ativos(self, desde: datetime) -> list[UtilizadorAtivoRegisto]:
        linhas = self._sessao.execute(
            select(
                Utilizador,
                func.count(SessaoExercicio.id),
                func.max(SessaoExercicio.created_at),
            )
            .join(SessaoExercicio, SessaoExercicio.user_id == Utilizador.id)
            .where(SessaoExercicio.created_at >= desde)
            .group_by(Utilizador.id)
            .order_by(func.max(SessaoExercicio.created_at).desc())
        ).all()
        return [
            UtilizadorAtivoRegisto(
                user_id=str(utilizador.id),
                utilizador_nome=utilizador.nome_completo,
                utilizador_email=utilizador.email,
                sessoes_no_periodo=total_sessoes,
                ultima_sessao_em=ultima_sessao_em,
            )
            for utilizador, total_sessoes, ultima_sessao_em in linhas
        ]
