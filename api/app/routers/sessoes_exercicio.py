from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import obter_utilizador_atual
from app.db import obter_sessao
from app.repositories.sessoes_exercicio_repository import (
    DadosVisao,
    SessaoExercicioRegisto,
    SQLAlchemySessoesExercicioRepository,
)
from app.repositories.utilizadores_repository import UtilizadorRegisto
from app.routers.exercicios import obter_acesso_exercicios_service
from app.schemas.sessao_exercicio import SessaoExercicioCriar, SessaoExercicioPublica
from app.services.acesso_exercicios_service import (
    AcessoExerciciosService,
    ExercicioDesconhecidoError,
    SemAcessoAoExercicioError,
)

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
    acesso: AcessoExerciciosService = Depends(obter_acesso_exercicios_service),
) -> SessaoExercicioRegisto:
    """Grava uma sessão terminada. O `user_id` vem do JWT — um `user_id`
    enviado no corpo nem existe no schema, quanto mais chega aqui.

    Todos os exercícios são pagos (Premium ou trial de 7 dias): sem direito
    de acesso a este exercício, 403 — mesmo que o pedido não venha da
    interface (CLAUDE.md §4.1)."""
    try:
        acesso.verificar_acesso(utilizador.id, dados.exercicio_id)
    except (ExercicioDesconhecidoError, SemAcessoAoExercicioError):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="sem acesso a este exercício")
    return repo.criar(
        user_id=utilizador.id,
        exercicio_id=dados.exercicio_id,
        duracao_segundos=dados.duracao_segundos,
        pontuacao=dados.pontuacao,
        precisao_percentual=dados.precisao_percentual,
        detalhes=dados.detalhes,
        visao=DadosVisao(
            versao=dados.versao,
            olho=dados.olho,
            segundos_activos=dados.segundos_activos,
            limiar=dados.limiar,
            unidade=dados.unidade,
            distancia_mm=dados.distancia_mm,
            px_por_mm=dados.px_por_mm,
            calibrado=dados.calibrado,
            sinais=dados.sinais,
        ),
    )


@router.get("", response_model=list[SessaoExercicioPublica])
def listar_minhas_sessoes(
    versao: int = Query(default=2, ge=1, le=2),
    desde: datetime | None = None,
    limite: int = Query(default=500, ge=1, le=1000),
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    repo: SQLAlchemySessoesExercicioRepository = Depends(obter_sessoes_exercicio_repository),
) -> list[SessaoExercicioRegisto]:
    """O meu histórico (progresso e relatório semanal). Só leitura das
    próprias sessões -- router fino, directo ao repository (CLAUDE.md §3).
    Não passa pelo controlo de acesso: ver os próprios resultados não é
    fazer um exercício. Por omissão só `versao` 2 -- as sessões antigas têm
    ids com outro significado."""
    return repo.listar_do_utilizador(utilizador.id, versao=versao, desde=desde, limite=limite)
