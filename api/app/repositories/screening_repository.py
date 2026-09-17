"""Acesso a dados dos rastreios (`screenings`).

Gravar um rastreio já processado é escrita simples — o cálculo clínico em
si acontece à parte, no `janelas-scanner-api` (ver CLAUDE.md secção 3: só
"calcular o diagnóstico" exige um service; persistir o resultado já
calculado é leitura/gravação simples, o router fala direto com este
repository). A única coisa em que o utilizador podia mentir — de quem é o
rastreio — resolve-se no router tirando o `user_id` do JWT, nunca do corpo.

Tal como `sessoes_exercicio_repository.py`: nenhum `try/except` à volta do
`commit()`. Se a gravação falhar, a excepção propaga.

**Nunca grava `imagem_path`** a partir de dados do browser — nenhum campo
de imagem é aceite aqui (CLAUDE.md secção 4, regra 4: nunca guardar
fotografias do scanner a longo prazo).
"""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.repositories.orm_models import Screening


@dataclass(frozen=True)
class ScreeningRegisto:
    id: str
    user_id: str
    estado: str
    rosto_detetado: bool
    requer_avaliacao_humana: bool
    encaminhado: bool
    assimetria_horizontal: float | None
    assimetria_vertical: float | None
    qualidade_captura: float | None
    qualidade_fiavel: bool | None
    qualidade_motivos: list[str]
    medicoes: dict | None
    versao_analise: str | None
    criado_em: datetime


class ScreeningsRepository(Protocol):
    def criar(
        self,
        user_id: str,
        estado: str,
        rosto_detetado: bool,
        requer_avaliacao_humana: bool,
        assimetria_horizontal: float | None,
        assimetria_vertical: float | None,
        qualidade_captura: float | None,
        qualidade_fiavel: bool | None,
        qualidade_motivos: list[str],
        medicoes: dict | None,
        versao_analise: str | None,
    ) -> ScreeningRegisto: ...

    def listar_do_utilizador(self, user_id: str, limite: int = 50) -> list[ScreeningRegisto]: ...


def _para_registo(row: Screening) -> ScreeningRegisto:
    return ScreeningRegisto(
        id=str(row.id),
        user_id=str(row.user_id),
        estado=row.estado,
        rosto_detetado=row.rosto_detetado,
        requer_avaliacao_humana=row.requer_avaliacao_humana,
        encaminhado=row.encaminhado,
        assimetria_horizontal=(
            float(row.assimetria_horizontal) if row.assimetria_horizontal is not None else None
        ),
        assimetria_vertical=(
            float(row.assimetria_vertical) if row.assimetria_vertical is not None else None
        ),
        qualidade_captura=(float(row.qualidade_captura) if row.qualidade_captura is not None else None),
        qualidade_fiavel=row.qualidade_fiavel,
        qualidade_motivos=list(row.qualidade_motivos or []),
        medicoes=row.medicoes,
        versao_analise=row.versao_analise,
        criado_em=row.criado_em,
    )


class SQLAlchemyScreeningsRepository:
    def __init__(self, sessao: Session) -> None:
        self._sessao = sessao

    def criar(
        self,
        user_id: str,
        estado: str,
        rosto_detetado: bool,
        requer_avaliacao_humana: bool,
        assimetria_horizontal: float | None,
        assimetria_vertical: float | None,
        qualidade_captura: float | None,
        qualidade_fiavel: bool | None,
        qualidade_motivos: list[str],
        medicoes: dict | None,
        versao_analise: str | None,
    ) -> ScreeningRegisto:
        row = Screening(
            user_id=uuid.UUID(user_id),
            estado=estado,
            rosto_detetado=rosto_detetado,
            requer_avaliacao_humana=requer_avaliacao_humana,
            assimetria_horizontal=assimetria_horizontal,
            assimetria_vertical=assimetria_vertical,
            qualidade_captura=qualidade_captura,
            qualidade_fiavel=qualidade_fiavel,
            qualidade_motivos=qualidade_motivos,
            medicoes=medicoes,
            versao_analise=versao_analise,
        )
        self._sessao.add(row)
        self._sessao.commit()
        self._sessao.refresh(row)
        return _para_registo(row)

    def listar_do_utilizador(self, user_id: str, limite: int = 50) -> list[ScreeningRegisto]:
        linhas = self._sessao.scalars(
            select(Screening)
            .where(Screening.user_id == uuid.UUID(user_id))
            .order_by(Screening.criado_em.desc())
            .limit(limite)
        ).all()
        return [_para_registo(r) for r in linhas]
