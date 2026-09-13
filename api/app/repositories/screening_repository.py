"""Acesso a dados de `screenings` — nunca a imagem, só as medições
calculadas a partir dos landmarks (ver CLAUDE.md secção 4 e o comentário em
`orm_models.Screening`). `ScreeningCalculado` é o resultado puro do cálculo
geométrico em `screening_service.py`; este ficheiro só o persiste.

Tal como `sessoes_exercicio_repository.py`: nenhum `try/except` à volta do
`commit()`. Se a gravação falhar, a excepção propaga.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from sqlalchemy.orm import Session

from app.repositories.orm_models import Screening

# Identifica o método de cálculo usado — permite distinguir resultados de
# versões futuras do algoritmo sem ambiguidade. Ver `screening_service.py`.
VERSAO_ANALISE = "geometria-iris-v1-experimental"


@dataclass(frozen=True)
class ScreeningCalculado:
    """Resultado do cálculo geométrico (ver `screening_service.py`) — ainda
    não tem `id` nem `user_id`, é só o que se vai persistir."""

    estado: str
    rosto_detetado: bool
    requer_avaliacao_humana: bool
    assimetria_horizontal: float | None
    assimetria_vertical: float | None
    qualidade_captura: float
    qualidade_fiavel: bool
    qualidade_motivos: list[str]
    medicoes: dict


@dataclass(frozen=True)
class ScreeningRegisto:
    id: str
    user_id: str
    estado: str
    rosto_detetado: bool
    requer_avaliacao_humana: bool
    assimetria_horizontal: float | None
    assimetria_vertical: float | None
    qualidade_captura: float | None
    qualidade_fiavel: bool | None
    qualidade_motivos: list[str]
    versao_analise: str
    criado_em: datetime


class ScreeningRepository(Protocol):
    def criar(self, user_id: str, calculado: ScreeningCalculado) -> ScreeningRegisto: ...
    def obter(self, screening_id: str) -> ScreeningRegisto | None: ...


def _para_registo(row: Screening) -> ScreeningRegisto:
    return ScreeningRegisto(
        id=str(row.id),
        user_id=str(row.user_id),
        estado=row.estado,
        rosto_detetado=row.rosto_detetado,
        requer_avaliacao_humana=row.requer_avaliacao_humana,
        assimetria_horizontal=float(row.assimetria_horizontal)
        if row.assimetria_horizontal is not None
        else None,
        assimetria_vertical=float(row.assimetria_vertical)
        if row.assimetria_vertical is not None
        else None,
        qualidade_captura=float(row.qualidade_captura) if row.qualidade_captura is not None else None,
        qualidade_fiavel=row.qualidade_fiavel,
        qualidade_motivos=list(row.qualidade_motivos or []),
        versao_analise=row.versao_analise or "",
        criado_em=row.criado_em,
    )


class SQLAlchemyScreeningRepository:
    def __init__(self, sessao: Session) -> None:
        self._sessao = sessao

    def criar(self, user_id: str, calculado: ScreeningCalculado) -> ScreeningRegisto:
        row = Screening(
            user_id=uuid.UUID(user_id),
            estado=calculado.estado,
            rosto_detetado=calculado.rosto_detetado,
            requer_avaliacao_humana=calculado.requer_avaliacao_humana,
            consentimento_imagem=False,
            encaminhado=False,
            assimetria_horizontal=calculado.assimetria_horizontal,
            assimetria_vertical=calculado.assimetria_vertical,
            qualidade_captura=calculado.qualidade_captura,
            qualidade_fiavel=calculado.qualidade_fiavel,
            qualidade_motivos=calculado.qualidade_motivos,
            medicoes=calculado.medicoes,
            imagem_path=None,
            versao_analise=VERSAO_ANALISE,
        )
        self._sessao.add(row)
        self._sessao.commit()
        self._sessao.refresh(row)
        return _para_registo(row)

    def obter(self, screening_id: str) -> ScreeningRegisto | None:
        row = self._sessao.get(Screening, uuid.UUID(screening_id))
        return _para_registo(row) if row else None
