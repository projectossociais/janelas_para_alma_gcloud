from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import obter_utilizador_atual
from app.db import obter_sessao
from app.repositories.screening_repository import (
    ScreeningRegisto,
    SQLAlchemyScreeningsRepository,
)
from app.repositories.utilizadores_repository import UtilizadorRegisto
from app.schemas.screening import ScreeningCriar, ScreeningPublica

router = APIRouter(prefix="/screenings", tags=["screenings"])


def obter_screenings_repository(
    sessao: Session = Depends(obter_sessao),
) -> SQLAlchemyScreeningsRepository:
    return SQLAlchemyScreeningsRepository(sessao)


@router.post("", response_model=ScreeningPublica, status_code=status.HTTP_201_CREATED)
def registar_screening(
    dados: ScreeningCriar,
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    repo: SQLAlchemyScreeningsRepository = Depends(obter_screenings_repository),
) -> ScreeningRegisto:
    """Grava o resultado de um rastreio já calculado pelo janelas-scanner-api.
    O `user_id` vem do JWT — um `user_id` enviado no corpo nem existe no
    schema, quanto mais chega aqui."""
    return repo.criar(
        user_id=utilizador.id,
        estado=dados.estado,
        rosto_detetado=dados.rosto_detetado,
        requer_avaliacao_humana=dados.requer_avaliacao_humana,
        diagnostico=dados.diagnostico,
        assimetria_horizontal=dados.assimetria_horizontal,
        assimetria_vertical=dados.assimetria_vertical,
        qualidade_captura=dados.qualidade_captura,
        qualidade_fiavel=dados.qualidade_fiavel,
        qualidade_motivos=dados.qualidade_motivos,
        medicoes=dados.medicoes,
        versao_analise=dados.versao_analise,
    )


@router.get("/minhas", response_model=list[ScreeningPublica])
def listar_minhas(
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    repo: SQLAlchemyScreeningsRepository = Depends(obter_screenings_repository),
) -> list[ScreeningRegisto]:
    return repo.listar_do_utilizador(utilizador.id)
