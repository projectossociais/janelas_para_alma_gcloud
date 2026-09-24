"""Jogo "Você Sabia Que..." -- quiz estilo Quem Quer Ser Milionário.

A resposta correta nunca sai da API antes da validação: `GET
/jogo/pergunta-aleatoria` devolve `PerguntaPublica` (sem `resposta_correta`
nem `explicacao`) e só `POST /jogo/validar` -- que compara no servidor --
é que revela qual era a certa.

Mesma fronteira de confiança na economia virtual: `POST /jogo/recompensas`
não recebe nenhum patamar do cliente -- lê sempre o progresso que o próprio
servidor rastreou (`JogoService`, a partir de respostas certas confirmadas
em `/jogo/validar`). `/jogo/validar` aceita sessão opcional (quem joga sem
conta continua a ver as respostas, só não acumula progresso nenhum -- sem
sessão nunca chega a `/jogo/recompensas`, que exige sessão).
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.config import obter_settings
from app.core.dependencies import (
    obter_utilizador_admin,
    obter_utilizador_atual,
    obter_utilizador_atual_opcional,
)
from app.db import obter_sessao
from app.repositories.jogo_repository import (
    PerguntaJogoRegisto,
    SQLAlchemyPerguntaJogoRepository,
    nivel_dificuldade_do_patamar,
)
from app.repositories.perfil_jogador_repository import (
    PerfilJogadorRegisto,
    SQLAlchemyPerfilJogadorRepository,
)
from app.repositories.utilizadores_repository import UtilizadorRegisto
from app.schemas.jogo import (
    ComprarPacoteRequest,
    LojaDiamantesPublica,
    PacoteDiamantesPublico,
    PerfilJogadorPublico,
    PerguntaAdmin,
    PerguntaCriar,
    PerguntaPublica,
    ValidarRespostaRequest,
    ValidarRespostaResponse,
)
from app.services.jogo_service import JogoService, PerguntaNaoEncontradaError, ResultadoResposta
from app.services.loja_jogo_service import (
    LojaJogoService,
    PacoteInexistenteError,
    PagamentosIndisponiveisError,
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


def obter_jogo_service(
    perguntas: SQLAlchemyPerguntaJogoRepository = Depends(obter_pergunta_jogo_repository),
    perfis: SQLAlchemyPerfilJogadorRepository = Depends(obter_perfil_jogador_repository),
) -> JogoService:
    return JogoService(perguntas, perfis)


def obter_loja_jogo_service(
    perfis: SQLAlchemyPerfilJogadorRepository = Depends(obter_perfil_jogador_repository),
) -> LojaJogoService:
    return LojaJogoService(perfis, pagamentos_simulados=obter_settings().jogo_pagamentos_simulados)


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
    utilizador: UtilizadorRegisto | None = Depends(obter_utilizador_atual_opcional),
    servico: JogoService = Depends(obter_jogo_service),
) -> ResultadoResposta:
    try:
        return servico.responder(
            utilizador.id if utilizador else None, dados.pergunta_id, dados.resposta_usuario
        )
    except PerguntaNaoEncontradaError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="pergunta não encontrada")


# --- Perfil e economia (exige sessão) ---------------------------------------


@router.get("/jogo/perfil", response_model=PerfilJogadorPublico)
def obter_perfil_jogador(
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    repo: SQLAlchemyPerfilJogadorRepository = Depends(obter_perfil_jogador_repository),
) -> PerfilJogadorRegisto:
    return repo.obter_ou_criar(utilizador.id)


@router.post("/jogo/recompensas", response_model=PerfilJogadorPublico)
def registar_recompensa(
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    servico: JogoService = Depends(obter_jogo_service),
) -> PerfilJogadorRegisto:
    return servico.reclamar_recompensa(utilizador.id)


# --- Loja de diamantes ------------------------------------------------------


@router.get("/jogo/loja/pacotes", response_model=LojaDiamantesPublica)
def listar_pacotes_diamantes(
    servico: LojaJogoService = Depends(obter_loja_jogo_service),
) -> LojaDiamantesPublica:
    return LojaDiamantesPublica(
        pacotes=[
            PacoteDiamantesPublico(
                id=p.id,
                diamantes=p.diamantes,
                bonus=p.bonus,
                total_diamantes=p.total_diamantes,
                preco_kz=p.preco_kz,
            )
            for p in servico.listar_pacotes()
        ],
        pagamento_simulado=servico.pagamentos_simulados,
    )


@router.post("/jogo/loja/compras", response_model=PerfilJogadorPublico)
def comprar_pacote_diamantes(
    dados: ComprarPacoteRequest,
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    servico: LojaJogoService = Depends(obter_loja_jogo_service),
) -> PerfilJogadorRegisto:
    try:
        return servico.comprar(utilizador.id, dados.pacote_id)
    except PacoteInexistenteError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="pacote de diamantes inexistente")
    except PagamentosIndisponiveisError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="a compra de diamantes ainda não está disponível",
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
