import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import obter_utilizador_atual
from app.db import obter_sessao
from app.repositories.bonus_assiduidade_repository import SQLAlchemyBonusAssiduidadeRepository
from app.repositories.sessoes_exercicio_repository import (
    DadosVisao,
    SessaoExercicioRegisto,
    SQLAlchemySessoesExercicioRepository,
)
from app.repositories.utilizadores_repository import UtilizadorRegisto
from app.routers.consentimento import exigir_consentimento_saude
from app.routers.exercicios import obter_acesso_exercicios_service
from app.schemas.sessao_exercicio import (
    BonusAssiduidadePublico,
    SessaoExercicioCriar,
    SessaoExercicioGravada,
    SessaoExercicioPublica,
)
from app.services.acesso_exercicios_service import (
    AcessoExerciciosService,
    ExercicioDesconhecidoError,
    SemAcessoAoExercicioError,
)
from app.services.bonus_assiduidade_service import BonusAssiduidadeService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sessoes-exercicio", tags=["sessoes-exercicio"])


def obter_sessoes_exercicio_repository(
    sessao: Session = Depends(obter_sessao),
) -> SQLAlchemySessoesExercicioRepository:
    return SQLAlchemySessoesExercicioRepository(sessao)


def obter_bonus_assiduidade_service(sessao: Session = Depends(obter_sessao)) -> BonusAssiduidadeService:
    return BonusAssiduidadeService(SQLAlchemyBonusAssiduidadeRepository(sessao))


@router.post("", response_model=SessaoExercicioGravada, status_code=status.HTTP_201_CREATED)
def registar_sessao(
    dados: SessaoExercicioCriar,
    # Resultados de testes visuais são dados de saúde: sem consentimento, 403.
    utilizador: UtilizadorRegisto = Depends(exigir_consentimento_saude),
    repo: SQLAlchemySessoesExercicioRepository = Depends(obter_sessoes_exercicio_repository),
    acesso: AcessoExerciciosService = Depends(obter_acesso_exercicios_service),
    bonus_service: BonusAssiduidadeService = Depends(obter_bonus_assiduidade_service),
) -> SessaoExercicioGravada:
    """Grava uma sessão terminada. O `user_id` vem do JWT — um `user_id`
    enviado no corpo nem existe no schema, quanto mais chega aqui.

    Todos os exercícios são pagos (Premium ou trial de 7 dias): sem direito
    de acesso a este exercício, 403 — mesmo que o pedido não venha da
    interface (CLAUDE.md §4.1)."""
    try:
        acesso.verificar_acesso(utilizador.id, dados.exercicio_id)
    except (ExercicioDesconhecidoError, SemAcessoAoExercicioError):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="sem acesso a este exercício")
    registo = repo.criar(
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
    # A sessão já está gravada: uma falha no bónus do jogo regista-se, mas nunca
    # transforma um treino guardado numa resposta de erro.
    bonus = None
    try:
        atribuido = bonus_service.registar_treino(
            utilizador.id, dados.exercicio_id, dados.versao, dados.segundos_activos, dados.sinais
        )
        if atribuido:
            bonus = BonusAssiduidadePublico(
                moedas=atribuido.moedas, diamantes=atribuido.diamantes, dias_seguidos=atribuido.dias_seguidos
            )
    except Exception:
        logger.exception("Falha ao creditar o bónus de assiduidade (sessão %s já gravada)", registo.id)
    return SessaoExercicioGravada(**SessaoExercicioPublica.model_validate(registo).model_dump(), bonus=bonus)


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
