"""Multijogador Local do "Inclusivamente" -- 2 pessoas à vez no mesmo
aparelho, na conta de quem tem sessão.

Tudo exige sessão: sem ela o modo local joga-se só com a reserva local do
frontend, sem prémio. Nenhum endpoint recebe pontos, acertos ou moedas do
cliente -- a pergunta, a validação e o prémio são do servidor
(`JogoLocalService`). Uma partida só responde à conta que a abriu (404 para
qualquer outra, sem distinguir de "não existe").
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import obter_utilizador_atual
from app.db import obter_sessao
from app.repositories.jogo_repository import SQLAlchemyPerguntaJogoRepository
from app.repositories.partida_local_jogo_repository import SQLAlchemyPartidaLocalJogoRepository
from app.repositories.perfil_jogador_repository import SQLAlchemyPerfilJogadorRepository
from app.repositories.utilizadores_repository import UtilizadorRegisto
from app.schemas.jogo import (
    IniciarPartidaLocalRequest,
    PartidaLocalPublica,
    PartidaLocalTerminadaResponse,
    PerfilJogadorPublico,
    PerguntaLocalRequest,
    PerguntaPublica,
    ResponderLocalRequest,
    RespostaLocalResponse,
)
from app.services.jogo_local_service import (
    LIMITE_DIARIO_MOEDAS,
    MAXIMO_DESEMPATES,
    MAXIMO_MOEDAS_POR_PARTIDA,
    MOEDAS_POR_ACERTO,
    RONDAS,
    JogoLocalService,
    LimiteDePerguntasError,
    NumeroDeJogadoresInvalidoError,
    PartidaLocalNaoEncontradaError,
    PartidaLocalTerminadaError,
    PerguntaForaDaPartidaLocalError,
)
from app.services.jogo_service import SemPerguntasError

router = APIRouter(tags=["jogo"])


def obter_jogo_local_service(sessao: Session = Depends(obter_sessao)) -> JogoLocalService:
    return JogoLocalService(
        SQLAlchemyPerguntaJogoRepository(sessao),
        SQLAlchemyPerfilJogadorRepository(sessao),
        SQLAlchemyPartidaLocalJogoRepository(sessao),
    )


_ERROS = (
    NumeroDeJogadoresInvalidoError,
    PartidaLocalNaoEncontradaError,
    PartidaLocalTerminadaError,
    PerguntaForaDaPartidaLocalError,
    LimiteDePerguntasError,
    SemPerguntasError,
)


def _erro_http(err: Exception) -> HTTPException:
    if isinstance(err, NumeroDeJogadoresInvalidoError):
        return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="número de jogadores inválido")
    if isinstance(err, PartidaLocalNaoEncontradaError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="partida local não encontrada")
    if isinstance(err, PartidaLocalTerminadaError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail="a partida local já terminou")
    if isinstance(err, PerguntaForaDaPartidaLocalError):
        return HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="esta pergunta não é a que a partida tem por responder"
        )
    if isinstance(err, LimiteDePerguntasError):
        return HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="a partida já teve todas as perguntas que podia ter"
        )
    if isinstance(err, SemPerguntasError):
        return HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="sem perguntas disponíveis")
    raise err


@router.post("/jogo/local/partidas", response_model=PartidaLocalPublica, status_code=status.HTTP_201_CREATED)
def iniciar_partida_local(
    dados: IniciarPartidaLocalRequest,
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    servico: JogoLocalService = Depends(obter_jogo_local_service),
) -> PartidaLocalPublica:
    """Abre uma partida local (abandona, sem prémio, a que estivesse em curso)."""
    try:
        partida = servico.iniciar(utilizador.id, dados.numero_jogadores)
    except _ERROS as err:
        raise _erro_http(err) from err
    return PartidaLocalPublica(
        id=partida.id,
        numero_jogadores=partida.numero_jogadores,
        rondas=RONDAS,
        maximo_desempates=MAXIMO_DESEMPATES,
        moedas_por_acerto=MOEDAS_POR_ACERTO,
        maximo_moedas_por_partida=MAXIMO_MOEDAS_POR_PARTIDA,
        limite_diario_moedas=LIMITE_DIARIO_MOEDAS,
    )


@router.post("/jogo/local/partidas/{partida_id}/pergunta", response_model=PerguntaPublica)
def pergunta_da_partida_local(
    partida_id: str,
    dados: PerguntaLocalRequest,
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    servico: JogoLocalService = Depends(obter_jogo_local_service),
) -> PerguntaPublica:
    """A próxima pergunta, sem a resposta certa. Idempotente enquanto a
    pergunta entregue não for respondida."""
    try:
        pergunta = servico.nova_pergunta(utilizador.id, partida_id, dados.patamar)
    except _ERROS as err:
        raise _erro_http(err) from err
    return PerguntaPublica.model_validate(pergunta)


@router.post("/jogo/local/partidas/{partida_id}/responder", response_model=RespostaLocalResponse)
def responder_na_partida_local(
    partida_id: str,
    dados: ResponderLocalRequest,
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    servico: JogoLocalService = Depends(obter_jogo_local_service),
) -> RespostaLocalResponse:
    try:
        resultado = servico.responder(utilizador.id, partida_id, dados.pergunta_id, dados.resposta)
    except _ERROS as err:
        raise _erro_http(err) from err
    return RespostaLocalResponse(
        correta=resultado.correta, resposta_correta=resultado.resposta_correta, explicacao=resultado.explicacao
    )


@router.post("/jogo/local/partidas/{partida_id}/terminar", response_model=PartidaLocalTerminadaResponse)
def terminar_partida_local(
    partida_id: str,
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    servico: JogoLocalService = Depends(obter_jogo_local_service),
) -> PartidaLocalTerminadaResponse:
    """Fecha a partida e credita o prémio em moedas, uma única vez."""
    try:
        terminada = servico.terminar(utilizador.id, partida_id)
    except _ERROS as err:
        raise _erro_http(err) from err
    return PartidaLocalTerminadaResponse(
        moedas_ganhas=terminada.moedas_ganhas,
        limite_diario_atingido=terminada.limite_diario_atingido,
        perfil=PerfilJogadorPublico.model_validate(terminada.perfil),
    )
