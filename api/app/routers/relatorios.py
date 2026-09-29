"""Relatório dos exercícios para o médico, por link temporário (Fase B).

Criar, listar e revogar links exige a sessão do dono; ler um relatório
partilhado é público (é o médico que abre o link) e só precisa do token --
ver `PartilhaRelatorioService` para as regras.
"""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.dependencies import obter_utilizador_atual
from app.db import obter_sessao
from app.repositories.partilha_relatorio_repository import (
    PartilhaRegisto,
    SQLAlchemyPartilhaRelatorioRepository,
)
from app.repositories.sessoes_exercicio_repository import SQLAlchemySessoesExercicioRepository
from app.repositories.utilizadores_repository import UtilizadorRegisto
from app.schemas.relatorio import (
    PartilhaRelatorioCriada,
    PartilhaRelatorioPublica,
    RelatorioPartilhadoPublico,
    SessaoRelatorio,
)
from app.services.partilha_relatorio_service import (
    LimiteDePartilhasError,
    LinkInvalidoError,
    PartilhaNaoEncontradaError,
    PartilhaRelatorioService,
    partilha_activa,
)

router = APIRouter(prefix="/relatorios", tags=["relatorios"])


def obter_partilha_relatorio_service(sessao: Session = Depends(obter_sessao)) -> PartilhaRelatorioService:
    return PartilhaRelatorioService(
        SQLAlchemyPartilhaRelatorioRepository(sessao), SQLAlchemySessoesExercicioRepository(sessao)
    )


def _publica(p: PartilhaRegisto) -> PartilhaRelatorioPublica:
    return PartilhaRelatorioPublica(
        id=p.id,
        criado_em=p.criado_em,
        expira_em=p.expira_em,
        revogado_em=p.revogado_em,
        activa=partilha_activa(p, datetime.now(UTC)),
    )


@router.post("/partilhas", response_model=PartilhaRelatorioCriada, status_code=status.HTTP_201_CREATED)
def criar_partilha(
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    servico: PartilhaRelatorioService = Depends(obter_partilha_relatorio_service),
) -> PartilhaRelatorioCriada:
    try:
        criada = servico.criar(utilizador.id)
    except LimiteDePartilhasError as exc:
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail="já tem 5 links activos -- revogue um antes de criar outro"
        ) from exc
    return PartilhaRelatorioCriada(**_publica(criada.partilha).model_dump(), token=criada.token)


@router.get("/partilhas", response_model=list[PartilhaRelatorioPublica])
def listar_partilhas(
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    servico: PartilhaRelatorioService = Depends(obter_partilha_relatorio_service),
) -> list[PartilhaRelatorioPublica]:
    return [_publica(p) for p in servico.listar(utilizador.id)]


@router.delete("/partilhas/{partilha_id}", status_code=status.HTTP_204_NO_CONTENT)
def revogar_partilha(
    partilha_id: str,
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    servico: PartilhaRelatorioService = Depends(obter_partilha_relatorio_service),
) -> Response:
    try:
        servico.revogar(utilizador.id, partilha_id)
    except PartilhaNaoEncontradaError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="link não encontrado") from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/partilhados/{token}", response_model=RelatorioPartilhadoPublico)
def ler_relatorio_partilhado(
    token: str,
    response: Response,
    servico: PartilhaRelatorioService = Depends(obter_partilha_relatorio_service),
) -> RelatorioPartilhadoPublico:
    # Dados de saúde (muitas vezes de crianças): nunca em cache de browsers ou proxies.
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Robots-Tag"] = "noindex, nofollow"
    try:
        r = servico.ler(token)
    except LinkInvalidoError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="link inválido ou expirado") from exc
    return RelatorioPartilhadoPublico(
        nome=r.nome,
        olho_mais_fraco=r.olho_mais_fraco,
        usa_oculos=r.usa_oculos,
        expira_em=r.expira_em,
        gerado_em=r.gerado_em,
        sessoes=[
            SessaoRelatorio(
                exercicio_id=s.exercicio_id,
                created_at=s.created_at,
                olho=s.olho,
                segundos_activos=s.segundos_activos,
                limiar=s.limiar,
                unidade=s.unidade,
                calibrado=s.calibrado,
                sinais=s.sinais,
            )
            for s in r.sessoes
        ],
    )
