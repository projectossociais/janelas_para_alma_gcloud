"""Multijogador Online do "Inclusivamente" -- duas pessoas, cada uma no seu
aparelho, na mesma sala.

Tudo exige sessão, e uma sala só responde aos seus dois jogadores (404 para
qualquer outra pessoa, sem distinguir de "não existe"). O aparelho pergunta
pelo estado de segundo a segundo (`GET /jogo/salas/{codigo}`): é simples,
passa pelo `/api` do Vercel com o cookie de sessão e não precisa de
WebSockets. Nenhum endpoint recebe pontos, tempos ou moedas do cliente
(`SalaJogoService`).

O que nunca sai antes de a ronda fechar: a resposta certa e a resposta do
adversário (só "já respondeu").
"""

import math
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.dependencies import obter_utilizador_atual
from app.db import obter_sessao
from app.repositories.jogo_repository import SQLAlchemyPerguntaJogoRepository
from app.repositories.notificador_admins import NotificadorAdminsNaApp
from app.repositories.perfil_repository import PerfilRepository, SQLAlchemyPerfilRepository
from app.repositories.sala_jogo_repository import SQLAlchemySalaJogoRepository
from app.repositories.utilizadores_repository import UtilizadorRegisto
from app.schemas.jogo import (
    ChatSalaPublico,
    JogadorSalaPublico,
    MensagemSalaPublica,
    MensagemSalaRequest,
    PerguntaPublica,
    PremioSalaPublico,
    ResponderNaSalaRequest,
    RevelacaoPublica,
    SalaPublica,
)
from app.services.jogo_service import SemPerguntasError
from app.services.sala_jogo_service import (
    RONDAS,
    TEMPO_POR_PERGUNTA,
    ChatIndisponivelError,
    FaltaJogadorError,
    MensagemDepressaDemaisError,
    MensagemRecusadaError,
    Participante,
    RondaFechadaError,
    SalaCheiaError,
    SalaJaComecouError,
    SalaJogoService,
    SalaNaoEncontradaError,
    SoAnfitriaoError,
    VistaDaSala,
    e_adulto,
    primeiro_nome,
)

router = APIRouter(tags=["jogo"])


def obter_sala_jogo_service(sessao: Session = Depends(obter_sessao)) -> SalaJogoService:
    return SalaJogoService(
        SQLAlchemySalaJogoRepository(sessao),
        SQLAlchemyPerguntaJogoRepository(sessao),
        NotificadorAdminsNaApp(sessao),
    )


def obter_perfil_repository(sessao: Session = Depends(obter_sessao)) -> PerfilRepository:
    return SQLAlchemyPerfilRepository(sessao)


def obter_participante(
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    perfis: PerfilRepository = Depends(obter_perfil_repository),
) -> Participante:
    """Quem entra numa sala, a partir da sessão -- nunca do corpo do pedido.
    A idade vem do perfil guardado, não de uma declaração no momento."""
    perfil = perfis.obter(utilizador.id)
    adulto = perfil is not None and e_adulto(
        perfil.data_nascimento, perfil.faixa_etaria, datetime.now(UTC).date()
    )
    return Participante(
        utilizador_id=utilizador.id, nome=primeiro_nome(utilizador.nome_completo, "Jogador"), adulto=adulto
    )


_ERROS = (
    SalaNaoEncontradaError,
    SalaCheiaError,
    SalaJaComecouError,
    SoAnfitriaoError,
    FaltaJogadorError,
    RondaFechadaError,
    ChatIndisponivelError,
    MensagemRecusadaError,
    MensagemDepressaDemaisError,
    SemPerguntasError,
)


def _erro_http(err: Exception) -> HTTPException:
    if isinstance(err, SalaNaoEncontradaError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="sala não encontrada")
    if isinstance(err, SalaCheiaError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail="sala_cheia")
    if isinstance(err, SalaJaComecouError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail="sala_ja_comecou")
    if isinstance(err, SoAnfitriaoError):
        return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="só quem criou a sala pode começar")
    if isinstance(err, FaltaJogadorError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail="falta o segundo jogador")
    if isinstance(err, RondaFechadaError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail="ronda_fechada")
    if isinstance(err, ChatIndisponivelError):
        return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"chat_indisponivel:{err.motivo}")
    if isinstance(err, MensagemRecusadaError):
        return HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"mensagem_recusada:{err.motivo}"
        )
    if isinstance(err, MensagemDepressaDemaisError):
        return HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="mensagem_depressa_demais")
    if isinstance(err, SemPerguntasError):
        return HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="sem perguntas disponíveis")
    raise err


def _publica(vista: VistaDaSala, utilizador_id: str) -> SalaPublica:
    sala = vista.sala
    eu = next(j for j in sala.jogadores if j.utilizador_id == utilizador_id)
    ronda_fechada = sala.fase == "revelacao"
    nomes = {j.utilizador_id: j.nome for j in sala.jogadores}

    segundos = None
    if sala.estado == "em_curso" and sala.fase == "pergunta" and sala.prazo_resposta is not None:
        segundos = max(0, math.ceil((sala.prazo_resposta - vista.agora).total_seconds()))

    revelacao = None
    if sala.estado == "em_curso" and ronda_fechada and vista.pergunta is not None:
        revelacao = RevelacaoPublica(
            resposta_correta=vista.pergunta.resposta_correta, explicacao=vista.pergunta.explicacao
        )

    premio = None
    if sala.estado == "terminada" and eu.moedas_ganhas is not None:
        premio = PremioSalaPublico(
            moedas_ganhas=eu.moedas_ganhas,
            limite_diario_atingido=eu.moedas_ganhas < (eu.moedas_sem_limite or 0),
        )

    return SalaPublica(
        codigo=sala.codigo,
        estado=sala.estado,
        fase=sala.fase if sala.estado == "em_curso" else None,
        ronda=sala.ronda,
        rondas=RONDAS,
        desempate=sala.desempate,
        sou_anfitriao=sala.anfitriao_id == utilizador_id,
        jogadores=[
            JogadorSalaPublico(
                nome=j.nome,
                eu=j.utilizador_id == utilizador_id,
                anfitriao=j.utilizador_id == sala.anfitriao_id,
                pontos=j.pontos,
                acertos=j.acertos,
                respondeu=j.respondeu_em is not None,
                resposta=j.resposta_ronda if ronda_fechada else None,
                certa=j.certa_ronda if ronda_fechada else None,
                pontos_ronda=j.pontos_ronda if ronda_fechada else None,
                vencedor=j.utilizador_id in sala.vencedores,
            )
            for j in sala.jogadores
        ],
        pergunta=PerguntaPublica.model_validate(vista.pergunta) if vista.pergunta is not None else None,
        tempo_por_pergunta=int(TEMPO_POR_PERGUNTA.total_seconds()),
        segundos_restantes=segundos,
        minha_resposta=eu.resposta_ronda if sala.estado == "em_curso" else None,
        revelacao=revelacao,
        motivo_fim=sala.motivo_fim,
        premio=premio,
        chat=ChatSalaPublico(
            disponivel=vista.chat_disponivel,
            motivo=vista.chat_motivo,
            eu_adulto=eu.adulto,
            mensagens=[
                MensagemSalaPublica(
                    id=m.id, minha=m.utilizador_id == utilizador_id, nome=nomes.get(m.utilizador_id, ""), texto=m.texto
                )
                for m in vista.mensagens
            ],
        ),
    )


@router.post("/jogo/salas", response_model=SalaPublica, status_code=status.HTTP_201_CREATED)
def criar_sala(
    participante: Participante = Depends(obter_participante),
    servico: SalaJogoService = Depends(obter_sala_jogo_service),
) -> SalaPublica:
    """Abre uma sala e devolve o código para dar ao outro jogador."""
    return _publica(servico.criar(participante), participante.utilizador_id)


@router.post("/jogo/salas/{codigo}/entrar", response_model=SalaPublica)
def entrar_na_sala(
    codigo: str,
    participante: Participante = Depends(obter_participante),
    servico: SalaJogoService = Depends(obter_sala_jogo_service),
) -> SalaPublica:
    try:
        vista = servico.entrar(codigo, participante)
    except _ERROS as err:
        raise _erro_http(err) from err
    return _publica(vista, participante.utilizador_id)


@router.post("/jogo/salas/{codigo}/comecar", response_model=SalaPublica)
def comecar_partida(
    codigo: str,
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    servico: SalaJogoService = Depends(obter_sala_jogo_service),
) -> SalaPublica:
    try:
        vista = servico.comecar(codigo, utilizador.id)
    except _ERROS as err:
        raise _erro_http(err) from err
    return _publica(vista, utilizador.id)


@router.get("/jogo/salas/{codigo}", response_model=SalaPublica)
def estado_da_sala(
    codigo: str,
    response: Response,
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    servico: SalaJogoService = Depends(obter_sala_jogo_service),
) -> SalaPublica:
    """O estado da sala. Chamado de segundo a segundo por cada aparelho: é o
    sinal de vida do jogador e o que faz a partida avançar."""
    try:
        vista = servico.estado(codigo, utilizador.id)
    except _ERROS as err:
        raise _erro_http(err) from err
    response.headers["Cache-Control"] = "no-store"
    return _publica(vista, utilizador.id)


@router.post("/jogo/salas/{codigo}/responder", response_model=SalaPublica)
def responder_na_sala(
    codigo: str,
    dados: ResponderNaSalaRequest,
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    servico: SalaJogoService = Depends(obter_sala_jogo_service),
) -> SalaPublica:
    try:
        vista = servico.responder(codigo, utilizador.id, dados.pergunta_id, dados.resposta)
    except _ERROS as err:
        raise _erro_http(err) from err
    return _publica(vista, utilizador.id)


@router.post("/jogo/salas/{codigo}/sair", status_code=status.HTTP_204_NO_CONTENT)
def sair_da_sala(
    codigo: str,
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    servico: SalaJogoService = Depends(obter_sala_jogo_service),
) -> Response:
    """Sair. Em jogo conta como desistência: o outro jogador ganha."""
    servico.sair(codigo, utilizador.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/jogo/salas/{codigo}/mensagens", response_model=SalaPublica)
def enviar_mensagem(
    codigo: str,
    dados: MensagemSalaRequest,
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    servico: SalaJogoService = Depends(obter_sala_jogo_service),
) -> SalaPublica:
    """Chat da sala -- só entre dois adultos, e depois de passar o filtro."""
    try:
        vista = servico.enviar_mensagem(codigo, utilizador.id, dados.texto)
    except _ERROS as err:
        raise _erro_http(err) from err
    return _publica(vista, utilizador.id)


@router.post("/jogo/salas/{codigo}/denunciar", response_model=SalaPublica)
def denunciar_chat(
    codigo: str,
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    servico: SalaJogoService = Depends(obter_sala_jogo_service),
) -> SalaPublica:
    """Fecha o chat da sala para os dois e avisa os admins."""
    try:
        vista = servico.denunciar(codigo, utilizador.id)
    except _ERROS as err:
        raise _erro_http(err) from err
    return _publica(vista, utilizador.id)
