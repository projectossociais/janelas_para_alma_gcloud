"""Acesso a dados das sessões de exercício.

Gravar uma sessão de exercício é escrita simples — o router fala directo
com este repository, sem service (ver CLAUDE.md secção 3, tabela: "Gravar
uma sessão de exercício" está do lado do router fino). A única coisa em
que o utilizador podia mentir — de quem é a sessão — resolve-se no router
tirando o `user_id` do JWT, nunca do corpo do pedido.

Tal como `doacoes_repository.py`: nenhum `try/except` à volta do `commit()`.
Se a gravação falhar, a excepção propaga — quem chama decide o que fazer,
este ficheiro nunca fabrica um sucesso.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.repositories.orm_models import SessaoExercicio


@dataclass(frozen=True)
class SessaoExercicioRegisto:
    id: str
    user_id: str
    exercicio_id: str
    duracao_segundos: int
    pontuacao: int
    precisao_percentual: float
    detalhes: dict | None
    created_at: datetime
    versao: int = 1
    olho: str | None = None
    segundos_activos: int | None = None
    limiar: float | None = None
    unidade: str | None = None
    distancia_mm: int | None = None
    px_por_mm: float | None = None
    calibrado: bool | None = None
    sinais: dict | None = None


@dataclass(frozen=True)
class DadosVisao:
    """Resultado de um exercício sem webcam (versão 2) -- tudo opcional."""

    versao: int = 1
    olho: str | None = None
    segundos_activos: int | None = None
    limiar: float | None = None
    unidade: str | None = None
    distancia_mm: int | None = None
    px_por_mm: float | None = None
    calibrado: bool | None = None
    sinais: dict | None = None


def _num(valor) -> float | None:
    return float(valor) if valor is not None else None


def _para_registo(row: SessaoExercicio) -> SessaoExercicioRegisto:
    return SessaoExercicioRegisto(
        id=str(row.id),
        user_id=str(row.user_id),
        exercicio_id=row.exercicio_id,
        duracao_segundos=row.duracao_segundos,
        pontuacao=row.pontuacao,
        precisao_percentual=float(row.precisao_percentual),
        detalhes=row.detalhes,
        created_at=row.created_at,
        versao=row.versao,
        olho=row.olho,
        segundos_activos=row.segundos_activos,
        limiar=_num(row.limiar),
        unidade=row.unidade,
        distancia_mm=row.distancia_mm,
        px_por_mm=_num(row.px_por_mm),
        calibrado=row.calibrado,
        sinais=row.sinais,
    )


class SessoesExercicioRepository(Protocol):
    def criar(
        self,
        user_id: str,
        exercicio_id: str,
        duracao_segundos: int,
        pontuacao: int,
        precisao_percentual: float,
        detalhes: dict | None,
        visao: DadosVisao | None = None,
    ) -> SessaoExercicioRegisto: ...

    def listar_do_utilizador(
        self, user_id: str, versao: int, desde: datetime | None, limite: int
    ) -> list[SessaoExercicioRegisto]: ...


class SQLAlchemySessoesExercicioRepository:
    def __init__(self, sessao: Session) -> None:
        self._sessao = sessao

    def criar(
        self,
        user_id: str,
        exercicio_id: str,
        duracao_segundos: int,
        pontuacao: int,
        precisao_percentual: float,
        detalhes: dict | None,
        visao: DadosVisao | None = None,
    ) -> SessaoExercicioRegisto:
        visao = visao or DadosVisao()
        row = SessaoExercicio(
            user_id=uuid.UUID(user_id),
            exercicio_id=exercicio_id,
            duracao_segundos=duracao_segundos,
            pontuacao=pontuacao,
            precisao_percentual=precisao_percentual,
            detalhes=detalhes,
            **visao.__dict__,
        )
        self._sessao.add(row)
        self._sessao.commit()
        self._sessao.refresh(row)
        return _para_registo(row)

    def listar_do_utilizador(
        self, user_id: str, versao: int, desde: datetime | None, limite: int
    ) -> list[SessaoExercicioRegisto]:
        """Só as sessões do próprio utilizador -- o `user_id` vem sempre do
        JWT, no router. Mais recentes primeiro."""
        consulta = select(SessaoExercicio).where(
            SessaoExercicio.user_id == uuid.UUID(user_id),
            SessaoExercicio.versao == versao,
        )
        if desde is not None:
            consulta = consulta.where(SessaoExercicio.created_at >= desde)
        consulta = consulta.order_by(SessaoExercicio.created_at.desc()).limit(limite)
        return [_para_registo(row) for row in self._sessao.scalars(consulta)]
