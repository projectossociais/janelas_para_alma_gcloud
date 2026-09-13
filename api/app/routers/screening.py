"""W-15 — sessão de rastreio (screening): calcula um sinal geométrico
experimental a partir de landmarks já extraídos no browser. Exige sessão
(nunca anónimo — é dado de saúde). Ler uma sessão exige ser o dono ou admin
(CLAUDE.md secção 4.1: nunca confiar num id vindo do pedido para decidir
acesso a dados de outra pessoa)."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import obter_utilizador_atual
from app.db import obter_sessao
from app.repositories.screening_repository import ScreeningRegisto, SQLAlchemyScreeningRepository
from app.repositories.utilizadores_repository import UtilizadorRegisto
from app.schemas.screening import ScreeningCriar, ScreeningPublica
from app.services.screening_service import Ponto, PoseCapturada, ScreeningService

router = APIRouter(prefix="/screenings", tags=["screenings"])


def obter_screening_repository(
    sessao: Session = Depends(obter_sessao),
) -> SQLAlchemyScreeningRepository:
    return SQLAlchemyScreeningRepository(sessao)


def obter_screening_service(
    repo: SQLAlchemyScreeningRepository = Depends(obter_screening_repository),
) -> ScreeningService:
    return ScreeningService(repo)


@router.post("", response_model=ScreeningPublica, status_code=status.HTTP_201_CREATED)
def criar_screening(
    dados: ScreeningCriar,
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    servico: ScreeningService = Depends(obter_screening_service),
) -> ScreeningRegisto:
    poses = [
        PoseCapturada(
            pose=p.pose, landmarks=[Ponto(x=l.x, y=l.y, z=l.z) for l in p.landmarks]
        )
        for p in dados.poses
    ]
    return servico.registar(utilizador.id, poses, dados.ambiente_escuro_em_algum_momento)


@router.get("/{screening_id}", response_model=ScreeningPublica)
def obter_screening(
    screening_id: str,
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    repo: SQLAlchemyScreeningRepository = Depends(obter_screening_repository),
) -> ScreeningRegisto:
    registo = repo.obter(screening_id)
    if registo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="sessão de rastreio não encontrada"
        )
    if registo.user_id != utilizador.id and utilizador.papel != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="não tem acesso a esta sessão"
        )
    return registo
