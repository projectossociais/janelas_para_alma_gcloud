"""Jogo "Você Sabia Que..." -- quiz estilo Quem Quer Ser Milionário.

A resposta correta nunca sai da API antes da validação: `GET
/jogo/pergunta-aleatoria` devolve `PerguntaPublica` (sem `resposta_correta`
nem `explicacao`) e só `POST /jogo/validar` -- que compara no servidor --
é que revela qual era a certa.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import obter_utilizador_admin
from app.db import obter_sessao
from app.repositories.jogo_repository import (
    PerguntaJogoRegisto,
    SQLAlchemyPerguntaJogoRepository,
    nivel_dificuldade_do_patamar,
)
from app.schemas.jogo import (
    PerguntaAdmin,
    PerguntaCriar,
    PerguntaPublica,
    ValidarRespostaRequest,
    ValidarRespostaResponse,
)

router = APIRouter(tags=["jogo"])


def obter_pergunta_jogo_repository(
    sessao: Session = Depends(obter_sessao),
) -> SQLAlchemyPerguntaJogoRepository:
    return SQLAlchemyPerguntaJogoRepository(sessao)


@router.get("/jogo/pergunta-aleatoria", response_model=PerguntaPublica)
def obter_pergunta_aleatoria(
    patamar: int = Query(ge=1, le=15),
    repo: SQLAlchemyPerguntaJogoRepository = Depends(obter_pergunta_jogo_repository),
) -> PerguntaJogoRegisto:
    nivel_dificuldade = nivel_dificuldade_do_patamar(patamar)
    pergunta = repo.obter_aleatoria(nivel_dificuldade)
    if pergunta is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="sem perguntas disponíveis")
    return pergunta


@router.post("/jogo/validar", response_model=ValidarRespostaResponse)
def validar_resposta(
    dados: ValidarRespostaRequest,
    repo: SQLAlchemyPerguntaJogoRepository = Depends(obter_pergunta_jogo_repository),
) -> ValidarRespostaResponse:
    pergunta = repo.obter_por_id(dados.pergunta_id)
    if pergunta is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="pergunta não encontrada")
    return ValidarRespostaResponse(
        correta=dados.resposta_usuario == pergunta.resposta_correta,
        resposta_correta=pergunta.resposta_correta,
        explicacao=pergunta.explicacao,
    )


# --- Gestão (só admin) ------------------------------------------------------


@router.post(
    "/admin/jogo/perguntas",
    response_model=PerguntaAdmin,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(obter_utilizador_admin)],
)
def criar_pergunta(
    dados: PerguntaCriar,
    repo: SQLAlchemyPerguntaJogoRepository = Depends(obter_pergunta_jogo_repository),
) -> PerguntaJogoRegisto:
    return repo.criar(
        texto_pergunta=dados.texto_pergunta,
        opcao_a=dados.opcao_a,
        opcao_b=dados.opcao_b,
        opcao_c=dados.opcao_c,
        opcao_d=dados.opcao_d,
        resposta_correta=dados.resposta_correta,
        nivel_dificuldade=dados.nivel_dificuldade,
        explicacao=dados.explicacao,
    )
