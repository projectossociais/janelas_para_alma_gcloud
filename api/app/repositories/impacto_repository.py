"""Números de impacto da página inicial: contagens agregadas, sem nenhum dado
pessoal, lidas directamente das tabelas onde o trabalho fica registado."""

from dataclasses import dataclass
from typing import Protocol

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.repositories.orm_models import AgendamentoClinico, Screening, SessaoExercicio


@dataclass(frozen=True)
class NumerosImpactoRegisto:
    rastreios: int
    sessoes_treino: int
    encaminhamentos: int


class ImpactoRepository(Protocol):
    def obter_numeros(self) -> NumerosImpactoRegisto: ...


class SQLAlchemyImpactoRepository:
    def __init__(self, sessao: Session) -> None:
        self._sessao = sessao

    def _contar(self, modelo, *condicoes) -> int:
        return self._sessao.scalar(select(func.count()).select_from(modelo).where(*condicoes)) or 0

    def obter_numeros(self) -> NumerosImpactoRegisto:
        # Encaminhamentos: rastreios que pediram avaliação + pedidos de
        # consulta a clínicas parceiras (a mesma pessoa pode estar nos dois).
        return NumerosImpactoRegisto(
            rastreios=self._contar(Screening),
            sessoes_treino=self._contar(SessaoExercicio),
            encaminhamentos=self._contar(Screening, Screening.diagnostico == "requer_avaliacao")
            + self._contar(AgendamentoClinico),
        )
