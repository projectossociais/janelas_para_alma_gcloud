"""Jogo "Você Sabia Que..." -- quiz estilo Quem Quer Ser Milionário.

A resposta correta nunca sai da API antes da validação: `GET
/jogo/pergunta-aleatoria` devolve `PerguntaPublica` (sem `resposta_correta`
nem `explicacao`) e só `POST /jogo/validar` -- que compara no servidor --
é que revela qual era a certa.

Mesma fronteira de confiança na economia virtual: `POST /jogo/recompensas`
recebe só o patamar alcançado, nunca moedas/diamantes -- é sempre o
servidor (`calcular_recompensa`) que decide quanto isso vale.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import obter_utilizador_admin, obter_utilizador_atual
from app.db import obter_sessao
from app.repositories.jogo_repository import (
    PerguntaJogoRegisto,
    SQLAlchemyPerguntaJogoRepository,
    nivel_dificuldade_do_patamar,
)
from app.repositories.perfil_jogador_repository import (
    PerfilJogadorRegisto,
    SQLAlchemyPerfilJogadorRepository,
    calcular_recompensa,
)
from app.repositories.utilizadores_repository import UtilizadorRegisto
from app.schemas.jogo import (
    PerfilJogadorPublico,
    PerguntaAdmin,
    PerguntaCriar,
    PerguntaPublica,
    RecompensaRequest,
    ValidarRespostaRequest,
    ValidarRespostaResponse,
)

router = APIRouter(tags=["jogo"])


def obter_pergunta_jogo_repository(
    sessao: Session = Depends(obter_sessao),
) -> SQLAlchemyPerguntaJogoRepository:
    return SQLAlchemyPerguntaJogoRepository(sessao)


def obter_perfil_jogador_repository(
    sessao: Session = Depends(obter_sessao),
) -> SQLAlchemyPerfilJogadorRepository:
    return SQLAlchemyPerfilJogadorRepository(sessao)


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


# --- Perfil e economia (exige sessão) ---------------------------------------


@router.get("/jogo/perfil", response_model=PerfilJogadorPublico)
def obter_perfil_jogador(
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    repo: SQLAlchemyPerfilJogadorRepository = Depends(obter_perfil_jogador_repository),
) -> PerfilJogadorRegisto:
    return repo.obter_ou_criar(utilizador.id)


@router.post("/jogo/recompensas", response_model=PerfilJogadorPublico)
def registar_recompensa(
    dados: RecompensaRequest,
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    repo: SQLAlchemyPerfilJogadorRepository = Depends(obter_perfil_jogador_repository),
) -> PerfilJogadorRegisto:
    moedas_ganhas, diamantes_ganhos = calcular_recompensa(dados.patamar_alcancado)
    return repo.registar_recompensa(
        utilizador.id, moedas_ganhas, diamantes_ganhos, dados.patamar_alcancado
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
