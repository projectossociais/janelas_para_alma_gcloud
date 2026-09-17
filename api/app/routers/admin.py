"""Painel de administração — listar contas e gerir quem é admin.

Tudo aqui exige `papel: admin` (via `obter_utilizador_admin`). O primeiro
admin cria-se por linha de comando (`python -m app.criar_admin <email>`);
a partir daí, um admin promove outros por aqui.
"""

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import obter_utilizador_admin
from app.db import obter_sessao
from app.repositories.admin_repository import AdminUtilizadorRegisto, SQLAlchemyAdminRepository
from app.repositories.admin_stats_repository import (
    EstatisticasRegisto,
    PendenciasRegisto,
    SessaoExercicioAdminRegisto,
    SQLAlchemyAdminStatsRepository,
    UtilizadorAtivoRegisto,
)
from app.repositories.utilizadores_repository import UtilizadorRegisto
from app.schemas.admin import (
    AdminUtilizadorPublico,
    DefinirPapel,
    EstatisticasAdmin,
    PendenciasAdmin,
    PromoverAdmin,
    SessaoExercicioAdmin,
    UtilizadorAtivoAdmin,
)
from app.services.admin_service import (
    AdminService,
    NaoPodeAlterarAdminPorAquiError,
    NaoPodeDespromoverASiProprioError,
    PapelInvalidoError,
    UltimoAdminError,
    UtilizadorNaoEncontradoError,
)

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(obter_utilizador_admin)])


def obter_admin_service(sessao: Session = Depends(obter_sessao)) -> AdminService:
    return AdminService(SQLAlchemyAdminRepository(sessao))


def obter_admin_repository(sessao: Session = Depends(obter_sessao)) -> SQLAlchemyAdminRepository:
    return SQLAlchemyAdminRepository(sessao)


def obter_admin_stats_repository(
    sessao: Session = Depends(obter_sessao),
) -> SQLAlchemyAdminStatsRepository:
    return SQLAlchemyAdminStatsRepository(sessao)


@router.post("/utilizadores/{utilizador_id}/papel", response_model=AdminUtilizadorPublico)
def definir_papel(
    utilizador_id: str,
    dados: DefinirPapel,
    servico: AdminService = Depends(obter_admin_service),
) -> AdminUtilizadorRegisto:
    try:
        return servico.definir_papel(utilizador_id, dados.papel)
    except PapelInvalidoError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"papel '{dados.papel}' inválido — use /promover para tornar alguém admin",
        ) from exc
    except NaoPodeAlterarAdminPorAquiError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="esta conta já é admin — use /remover-admin para lhe tirar o acesso",
        ) from exc
    except UtilizadorNaoEncontradoError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="conta não encontrada") from exc


@router.get("/estatisticas", response_model=EstatisticasAdmin)
def obter_estatisticas(
    dias: int = 30,
    repo: SQLAlchemyAdminStatsRepository = Depends(obter_admin_stats_repository),
) -> EstatisticasRegisto:
    # Sem isto, um `dias` absurdo (negativo, ou milhões) fazia a série
    # devolver um payload gigante ou vazio -- limite generoso mas real.
    dias_limitado = min(max(dias, 1), 365)
    desde = datetime.now(UTC) - timedelta(days=dias_limitado)
    return repo.obter_estatisticas(desde, dias_limitado)


@router.get("/pendencias", response_model=PendenciasAdmin)
def obter_pendencias(
    repo: SQLAlchemyAdminStatsRepository = Depends(obter_admin_stats_repository),
) -> PendenciasRegisto:
    return repo.obter_pendencias()


@router.get("/utilizadores", response_model=list[AdminUtilizadorPublico])
def listar_utilizadores(
    papel: str | None = None,
    dias: int | None = None,
    repo: SQLAlchemyAdminRepository = Depends(obter_admin_repository),
) -> list[AdminUtilizadorRegisto]:
    # `dias` é o mesmo período do card "Novos utilizadores" no dashboard —
    # clicar nesse card traz para aqui só quem se registou nesse intervalo.
    desde = datetime.now(UTC) - timedelta(days=min(max(dias, 1), 365)) if dias else None
    return repo.listar(papel=papel, desde=desde)


@router.get("/sessoes-exercicio", response_model=list[SessaoExercicioAdmin])
def listar_sessoes_exercicio(
    dias: int = 30,
    repo: SQLAlchemyAdminStatsRepository = Depends(obter_admin_stats_repository),
) -> list[SessaoExercicioAdminRegisto]:
    dias_limitado = min(max(dias, 1), 365)
    desde = datetime.now(UTC) - timedelta(days=dias_limitado)
    return repo.listar_sessoes_exercicio(desde)


@router.get("/ativos-semana", response_model=list[UtilizadorAtivoAdmin])
def listar_ativos_semana(
    repo: SQLAlchemyAdminStatsRepository = Depends(obter_admin_stats_repository),
) -> list[UtilizadorAtivoRegisto]:
    return repo.listar_ativos_semana()


@router.post("/utilizadores/promover", response_model=AdminUtilizadorPublico)
def promover_a_admin(
    dados: PromoverAdmin,
    servico: AdminService = Depends(obter_admin_service),
) -> AdminUtilizadorRegisto:
    try:
        return servico.promover_a_admin(dados.email)
    except UtilizadorNaoEncontradoError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="não há nenhuma conta com esse email — peça-lhe para se registar primeiro",
        ) from exc


@router.post("/utilizadores/{utilizador_id}/remover-admin", response_model=AdminUtilizadorPublico)
def remover_admin(
    utilizador_id: str,
    executor: UtilizadorRegisto = Depends(obter_utilizador_admin),
    servico: AdminService = Depends(obter_admin_service),
) -> AdminUtilizadorRegisto:
    try:
        return servico.despromover(utilizador_id, executor.id)
    except NaoPodeDespromoverASiProprioError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="não pode remover o seu próprio acesso de admin"
        ) from exc
    except UltimoAdminError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="é o último admin — promova outra conta antes de remover esta",
        ) from exc
    except UtilizadorNaoEncontradoError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="conta não encontrada") from exc
