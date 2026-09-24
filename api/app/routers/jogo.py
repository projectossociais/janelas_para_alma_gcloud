"""Jogo "Inclusivamente" (quiz "Você Sabia Que...", estilo Quem Quer Ser
Milionário).

A resposta correcta nunca sai da API antes da validação: `GET
/jogo/pergunta-aleatoria` devolve `PerguntaPublica` (sem `resposta_correta`
nem `explicacao`). Com sessão, nem a validação a revela se o jogador errou --
a partida fica à espera da decisão sobre a vida extra, e a resposta só se
revela em `POST /jogo/partidas/atual/terminar`.

Mesma fronteira de confiança na economia virtual: nenhum endpoint recebe um
patamar, preço ou quantidade do cliente. O progresso, as vidas extra, as
ajudas usadas e o prémio vivem numa partida controlada pelo servidor
(`JogoService` + `partidas_jogo`). Sem sessão joga-se na mesma, sem partida,
progresso nem prémio.
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
from app.repositories.mercado_jogo_repository import SQLAlchemyMercadoJogoRepository
from app.repositories.partida_jogo_repository import SQLAlchemyPartidaJogoRepository
from app.repositories.perfil_jogador_repository import (
    PerfilJogadorRegisto,
    SQLAlchemyPerfilJogadorRepository,
)
from app.repositories.utilizadores_repository import UtilizadorRegisto
from app.schemas.jogo import (
    AjudaMercadoResponse,
    AjudaPerguntaRequest,
    CinquentaCinquentaResponse,
    ComprarAjudaMercadoRequest,
    ComprarPacoteRequest,
    LojaDiamantesPublica,
    MercadoPublico,
    OpiniaoPublicoResponse,
    PacoteDiamantesPublico,
    PartidaPublica,
    PartidaTerminadaResponse,
    PerfilJogadorPublico,
    PerguntaAdmin,
    PerguntaCriar,
    PerguntaPublica,
    ValidarRespostaRequest,
    ValidarRespostaResponse,
    VendedorMercadoPublico,
    VidaExtraResponse,
)
from app.services.jogo_service import (
    AjudaJaUsadaError,
    JogoService,
    PartidaADecidirError,
    PartidaTerminada,
    PerguntaNaoEncontradaError,
    ResultadoResposta,
    VidaExtraIndisponivelError,
    VidaExtraUsada,
)
from app.services.jogo_service import (
    DiamantesInsuficientesError as DiamantesInsuficientesVidaExtraError,
)
from app.services.loja_jogo_service import (
    LojaJogoService,
    PacoteInexistenteError,
    PagamentosIndisponiveisError,
)
from app.services.mercado_jogo_service import (
    AjudaVendida,
    DiamantesInsuficientesError,
    MercadoJogoService,
    VendedorBloqueadoError,
    VendedorInexistenteError,
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


def obter_partida_jogo_repository(
    sessao: Session = Depends(obter_sessao),
) -> SQLAlchemyPartidaJogoRepository:
    return SQLAlchemyPartidaJogoRepository(sessao)


def obter_jogo_service(
    perguntas: SQLAlchemyPerguntaJogoRepository = Depends(obter_pergunta_jogo_repository),
    perfis: SQLAlchemyPerfilJogadorRepository = Depends(obter_perfil_jogador_repository),
    partidas: SQLAlchemyPartidaJogoRepository = Depends(obter_partida_jogo_repository),
) -> JogoService:
    return JogoService(perguntas, perfis, partidas)


def _erro_a_decidir() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT, detail="a partida está à espera da decisão sobre a vida extra"
    )


def obter_loja_jogo_service(
    perfis: SQLAlchemyPerfilJogadorRepository = Depends(obter_perfil_jogador_repository),
) -> LojaJogoService:
    return LojaJogoService(perfis, pagamentos_simulados=obter_settings().jogo_pagamentos_simulados)


def obter_mercado_jogo_repository(
    sessao: Session = Depends(obter_sessao),
) -> SQLAlchemyMercadoJogoRepository:
    return SQLAlchemyMercadoJogoRepository(sessao)


def obter_mercado_jogo_service(
    mercado: SQLAlchemyMercadoJogoRepository = Depends(obter_mercado_jogo_repository),
    perguntas: SQLAlchemyPerguntaJogoRepository = Depends(obter_pergunta_jogo_repository),
) -> MercadoJogoService:
    return MercadoJogoService(mercado, perguntas)


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
    except PartidaADecidirError:
        raise _erro_a_decidir()


@router.post("/jogo/tempo-esgotado", response_model=ValidarRespostaResponse)
def tempo_esgotado(
    dados: AjudaPerguntaRequest,
    utilizador: UtilizadorRegisto | None = Depends(obter_utilizador_atual_opcional),
    servico: JogoService = Depends(obter_jogo_service),
) -> ResultadoResposta:
    try:
        return servico.esgotar_tempo(utilizador.id if utilizador else None, dados.pergunta_id)
    except PerguntaNaoEncontradaError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="pergunta não encontrada")
    except PartidaADecidirError:
        raise _erro_a_decidir()


# --- Ajudas grátis (nunca mexem no progresso; uma vez por partida) ----------


def _erro_ajuda(err: Exception) -> HTTPException:
    if isinstance(err, PerguntaNaoEncontradaError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="pergunta não encontrada")
    if isinstance(err, AjudaJaUsadaError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail="esta ajuda já foi usada nesta partida")
    return _erro_a_decidir()


@router.post("/jogo/ajudas/cinquenta-cinquenta", response_model=CinquentaCinquentaResponse)
def ajuda_cinquenta_cinquenta(
    dados: AjudaPerguntaRequest,
    utilizador: UtilizadorRegisto | None = Depends(obter_utilizador_atual_opcional),
    servico: JogoService = Depends(obter_jogo_service),
) -> CinquentaCinquentaResponse:
    try:
        eliminadas = servico.cinquenta_cinquenta(utilizador.id if utilizador else None, dados.pergunta_id)
    except (PerguntaNaoEncontradaError, AjudaJaUsadaError, PartidaADecidirError) as err:
        raise _erro_ajuda(err)
    return CinquentaCinquentaResponse(opcoes_eliminadas=eliminadas)


@router.post("/jogo/ajudas/opiniao-publico", response_model=OpiniaoPublicoResponse)
def ajuda_opiniao_publico(
    dados: AjudaPerguntaRequest,
    utilizador: UtilizadorRegisto | None = Depends(obter_utilizador_atual_opcional),
    servico: JogoService = Depends(obter_jogo_service),
) -> OpiniaoPublicoResponse:
    try:
        percentagens = servico.opiniao_publico(utilizador.id if utilizador else None, dados.pergunta_id)
    except (PerguntaNaoEncontradaError, AjudaJaUsadaError, PartidaADecidirError) as err:
        raise _erro_ajuda(err)
    return OpiniaoPublicoResponse(percentagens=percentagens)


# --- Partida (exige sessão) --------------------------------------------------


@router.post("/jogo/partidas", response_model=PartidaPublica, status_code=status.HTTP_201_CREATED)
def iniciar_partida(
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    servico: JogoService = Depends(obter_jogo_service),
):
    return servico.iniciar_partida(utilizador.id)


@router.post("/jogo/partidas/atual/vida-extra", response_model=VidaExtraResponse)
def usar_vida_extra(
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    servico: JogoService = Depends(obter_jogo_service),
) -> VidaExtraUsada:
    try:
        return servico.usar_vida_extra(utilizador.id)
    except VidaExtraIndisponivelError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="vida extra indisponível")
    except DiamantesInsuficientesVidaExtraError:
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail="diamantes insuficientes")


@router.post("/jogo/partidas/atual/terminar", response_model=PartidaTerminadaResponse)
def terminar_partida(
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    servico: JogoService = Depends(obter_jogo_service),
) -> PartidaTerminada:
    return servico.terminar_partida(utilizador.id)


# --- Mercado (ajuda paga, exige sessão) -------------------------------------


@router.get("/jogo/mercado", response_model=MercadoPublico)
def listar_mercado(
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    servico: MercadoJogoService = Depends(obter_mercado_jogo_service),
) -> MercadoPublico:
    return MercadoPublico(
        agora=servico.agora(),
        vendedores=[
            VendedorMercadoPublico(
                id=e.vendedor.id,
                custo_diamantes=e.vendedor.custo_diamantes,
                precisao=e.vendedor.precisao,
                disponivel_em=e.disponivel_em,
            )
            for e in servico.listar(utilizador.id)
        ],
    )


@router.post("/jogo/mercado/comprar", response_model=AjudaMercadoResponse)
def comprar_ajuda_mercado(
    dados: ComprarAjudaMercadoRequest,
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    servico: MercadoJogoService = Depends(obter_mercado_jogo_service),
) -> AjudaVendida:
    try:
        return servico.comprar(utilizador.id, dados.vendedor_id, dados.pergunta_id, dados.opcoes_excluidas)
    except VendedorInexistenteError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="vendedor inexistente")
    except PerguntaNaoEncontradaError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="pergunta não encontrada")
    except VendedorBloqueadoError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="este vendedor ainda está bloqueado")
    except DiamantesInsuficientesError:
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail="diamantes insuficientes")


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
    # Compatibilidade com clientes anteriores às partidas (2026-09-24) --
    # o frontend (Vercel) e a API (Cloud Run) fazem deploy em separado.
    return servico.terminar_partida(utilizador.id).perfil


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
