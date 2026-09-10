from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import obter_utilizador_atual
from app.db import obter_sessao
from app.repositories.sessoes_exercicio_repository import (
    SessaoExercicioRegisto,
    SQLAlchemySessoesExercicioRepository,
)
from app.repositories.utilizadores_repository import UtilizadorRegisto
from app.schemas.sessao_exercicio import SessaoExercicioCriar, SessaoExercicioPublica

router = APIRouter(prefix="/sessoes-exercicio", tags=["sessoes-exercicio"])


def obter_sessoes_exercicio_repository(
    sessao: Session = Depends(obter_sessao),
) -> SQLAlchemySessoesExercicioRepository:
    return SQLAlchemySessoesExercicioRepository(sessao)


@router.post("", response_model=SessaoExercicioPublica, status_code=status.HTTP_201_CREATED)
def registar_sessao(
    dados: SessaoExercicioCriar,
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    repo: SQLAlchemySessoesExercicioRepository = Depends(obter_sessoes_exercicio_repository),
) -> SessaoExercicioRegisto:
    """Grava uma sessão terminada. O `user_id` vem do JWT — um `user_id`
    enviado no corpo nem existe no schema, quanto mais chega aqui."""
    return repo.criar(
        user_id=utilizador.id,
        exercicio_id=dados.exercicio_id,
        duracao_segundos=dados.duracao_segundos,
        pontuacao=dados.pontuacao,
        precisao_percentual=dados.precisao_percentual,
        detalhes=dados.detalhes,
    )
