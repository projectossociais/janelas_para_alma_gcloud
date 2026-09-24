"""Jogo "Inclusivamente" (quiz "Você Sabia Que...", estilo Quem Quer Ser
Milionário).

Tudo exige sessão (desde 2026-09-24): quem joga sem conta usa só a reserva
local do frontend, sem prémio. As perguntas saem da partida
(`POST /jogo/partidas/atual/pergunta`, sem `resposta_correta` nem
`explicacao`) e só essa pergunta se pode validar, ajudar ou comprar no
Mercado -- antes, `/jogo/validar` aceitava qualquer id sem sessão e servia
de oráculo para a resposta certa. Ao errar, nem a validação revela a
resposta: a partida fica à espera da decisão sobre a vida extra, e a
resposta só se revela em `POST /jogo/partidas/atual/terminar`.

Mesma fronteira de confiança na economia virtual: nenhum endpoint recebe um
patamar, preço ou quantidade do cliente. O progresso, a sequência de acertos,
as vidas extra, as ajudas usadas e o prémio vivem numa partida controlada
pelo servidor (`JogoService` + `partidas_jogo`).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import obter_settings
from app.core.dependencies import obter_utilizador_admin, obter_utilizador_atual
from app.db import obter_sessao
from app.repositories.estatisticas_jogo_repository import SQLAlchemyEstatisticasJogoRepository
from app.repositories.jogo_repository import PerguntaJogoRegisto, SQLAlchemyPerguntaJogoRepository
from app.repositories.mercado_jogo_repository import SQLAlchemyMercadoJogoRepository
from app.repositories.partida_jogo_repository import SQLAlchemyPartidaJogoRepository
from app.repositories.pedido_diamantes_repository import (
    PedidoDiamantesRegisto,
    SQLAlchemyPedidoDiamantesRepository,
)
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
    EstatisticaCategoriaPublica,
    EstatisticasJogadorPublicas,
    LojaDiamantesPublica,
    MercadoPublico,
    NivelJogadorPublico,
    NovaPerguntaRequest,
    OpiniaoPublicoResponse,
    PacoteDiamantesPublico,
    PartidaPublica,
    PartidaTerminadaResponse,
    PedidoDiamantesAdmin,
    PedidoDiamantesPublico,
    PedirDiamantesKwanzasRequest,
    PerfilJogadorPublico,
    PerguntaAdmin,
    PerguntaCriar,
    PerguntaDaPartidaPublica,
    ValidarRespostaRequest,
    ValidarRespostaResponse,
    VendedorMercadoPublico,
    VidaExtraResponse,
)
from app.services.comprovativo_upload_service import ChaveDeComprovativoInvalidaError
from app.services.estatisticas_jogador_service import EstatisticasJogadorService
from app.services.jogo_service import (
    AjudaJaUsadaError,
    JogoService,
    PartidaADecidirError,
    PartidaCompletaError,
    PartidaTerminada,
    PerguntaForaDaPartidaError,
    PerguntaNaoEncontradaError,
    ResultadoResposta,
    SemPerguntasError,
    VidaExtraIndisponivelError,
    VidaExtraUsada,
)
from app.services.jogo_service import (
    DiamantesInsuficientesError as DiamantesInsuficientesVidaExtraError,
)
from app.services.loja_jogo_service import (
    LojaJogoService,
    MoedasInsuficientesError,
    PacoteInexistenteError,
    PagamentosIndisponiveisError,
    PedidoDiamantesJaDecididoError,
    PedidoDiamantesNaoEncontradoError,
    PedidoDiamantesSemContaError,
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


def _erro_de_jogo(err: Exception) -> HTTPException:
    """Traduz os erros de domínio do jogo para HTTP (um só sítio)."""
    if isinstance(err, PerguntaNaoEncontradaError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="pergunta não encontrada")
    if isinstance(err, SemPerguntasError):
        # 503, não 404: não há pergunta nenhuma nem depois do seed em runtime
        # -- é o servidor que não está pronto, não um recurso inexistente.
        return HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="sem perguntas disponíveis")
    if isinstance(err, PerguntaForaDaPartidaError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail="esta pergunta não é a da partida em curso")
    if isinstance(err, PartidaADecidirError):
        return HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="a partida está à espera da decisão sobre a vida extra"
        )
    if isinstance(err, PartidaCompletaError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail="a partida já superou todos os patamares")
    if isinstance(err, AjudaJaUsadaError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail="esta ajuda já foi usada nesta partida")
    raise err


_ERROS_DE_JOGO = (
    PerguntaNaoEncontradaError,
    SemPerguntasError,
    PerguntaForaDaPartidaError,
    PartidaADecidirError,
    PartidaCompletaError,
    AjudaJaUsadaError,
)


def obter_loja_jogo_service(
    perfis: SQLAlchemyPerfilJogadorRepository = Depends(obter_perfil_jogador_repository),
    sessao: Session = Depends(obter_sessao),
) -> LojaJogoService:
    return LojaJogoService(
        perfis,
        SQLAlchemyPedidoDiamantesRepository(sessao),
        pagamentos_simulados=obter_settings().jogo_pagamentos_simulados,
    )


def obter_mercado_jogo_repository(
    sessao: Session = Depends(obter_sessao),
) -> SQLAlchemyMercadoJogoRepository:
    return SQLAlchemyMercadoJogoRepository(sessao)


def obter_mercado_jogo_service(
    mercado: SQLAlchemyMercadoJogoRepository = Depends(obter_mercado_jogo_repository),
    perguntas: SQLAlchemyPerguntaJogoRepository = Depends(obter_pergunta_jogo_repository),
    partidas: SQLAlchemyPartidaJogoRepository = Depends(obter_partida_jogo_repository),
) -> MercadoJogoService:
    return MercadoJogoService(mercado, perguntas, partidas)


# --- Perguntas e respostas (exigem sessão e a pergunta da partida) ---------


@router.post("/jogo/partidas/atual/pergunta", response_model=PerguntaDaPartidaPublica)
def nova_pergunta(
    dados: NovaPerguntaRequest | None = None,
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    servico: JogoService = Depends(obter_jogo_service),
) -> PerguntaDaPartidaPublica:
    """A pergunta do próximo patamar, presa à partida. Idempotente sem
    corpo; `{"trocar": true}` gasta a ajuda "trocar pergunta"."""
    try:
        resultado = servico.nova_pergunta(utilizador.id, trocar=bool(dados and dados.trocar))
    except _ERROS_DE_JOGO as err:
        raise _erro_de_jogo(err)
    p = resultado.pergunta
    return PerguntaDaPartidaPublica(
        id=p.id,
        texto_pergunta=p.texto_pergunta,
        opcao_a=p.opcao_a,
        opcao_b=p.opcao_b,
        opcao_c=p.opcao_c,
        opcao_d=p.opcao_d,
        patamar=resultado.patamar,
    )


@router.post("/jogo/validar", response_model=ValidarRespostaResponse)
def validar_resposta(
    dados: ValidarRespostaRequest,
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    servico: JogoService = Depends(obter_jogo_service),
) -> ResultadoResposta:
    try:
        return servico.responder(utilizador.id, dados.pergunta_id, dados.resposta_usuario)
    except _ERROS_DE_JOGO as err:
        raise _erro_de_jogo(err)


@router.post("/jogo/tempo-esgotado", response_model=ValidarRespostaResponse)
def tempo_esgotado(
    dados: AjudaPerguntaRequest,
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    servico: JogoService = Depends(obter_jogo_service),
) -> ResultadoResposta:
    try:
        return servico.esgotar_tempo(utilizador.id, dados.pergunta_id)
    except _ERROS_DE_JOGO as err:
        raise _erro_de_jogo(err)


# --- Ajudas grátis (nunca mexem no progresso; uma vez por partida) ----------


@router.post("/jogo/ajudas/cinquenta-cinquenta", response_model=CinquentaCinquentaResponse)
def ajuda_cinquenta_cinquenta(
    dados: AjudaPerguntaRequest,
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    servico: JogoService = Depends(obter_jogo_service),
) -> CinquentaCinquentaResponse:
    try:
        return CinquentaCinquentaResponse(
            opcoes_eliminadas=servico.cinquenta_cinquenta(utilizador.id, dados.pergunta_id)
        )
    except _ERROS_DE_JOGO as err:
        raise _erro_de_jogo(err)


@router.post("/jogo/ajudas/opiniao-publico", response_model=OpiniaoPublicoResponse)
def ajuda_opiniao_publico(
    dados: AjudaPerguntaRequest,
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    servico: JogoService = Depends(obter_jogo_service),
) -> OpiniaoPublicoResponse:
    try:
        return OpiniaoPublicoResponse(percentagens=servico.opiniao_publico(utilizador.id, dados.pergunta_id))
    except _ERROS_DE_JOGO as err:
        raise _erro_de_jogo(err)


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
    mercado = servico.listar(utilizador.id)
    return MercadoPublico(
        agora=servico.agora(),
        categoria=mercado.categoria,
        vendedores=[
            VendedorMercadoPublico(
                id=e.vendedor.id,
                custo_diamantes=e.vendedor.custo_diamantes,
                precisao=e.precisao,
                precisao_base=e.vendedor.precisao,
                afinidade=e.afinidade,
                disponivel_em=e.disponivel_em,
            )
            for e in mercado.vendedores
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
    except (PerguntaNaoEncontradaError, PerguntaForaDaPartidaError) as err:
        raise _erro_de_jogo(err)
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


def obter_estatisticas_jogador_service(
    sessao: Session = Depends(obter_sessao),
) -> EstatisticasJogadorService:
    return EstatisticasJogadorService(
        SQLAlchemyPerfilJogadorRepository(sessao), SQLAlchemyEstatisticasJogoRepository(sessao)
    )


@router.get("/jogo/perfil/estatisticas", response_model=EstatisticasJogadorPublicas)
def obter_estatisticas_jogador(
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    servico: EstatisticasJogadorService = Depends(obter_estatisticas_jogador_service),
) -> EstatisticasJogadorPublicas:
    """Nível, totais e acertos por categoria -- do próprio jogador (o id vem
    sempre da sessão, nunca do pedido)."""
    e = servico.obter(utilizador.id)
    return EstatisticasJogadorPublicas(
        perfil=PerfilJogadorPublico.model_validate(e.perfil),
        nivel=NivelJogadorPublico(
            numero=e.nivel.nivel.numero,
            id=e.nivel.nivel.id,
            patamares_total=e.nivel.patamares_total,
            minimo=e.nivel.nivel.minimo,
            proximo_minimo=e.nivel.proximo_minimo,
            progresso=round(e.nivel.progresso, 4),
        ),
        categorias=[
            EstatisticaCategoriaPublica(
                categoria=c.categoria,
                respostas=c.respostas,
                acertos=c.acertos,
                taxa_acerto=round(c.taxa_acerto, 4),
            )
            for c in e.categorias
        ],
    )


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
    # O catálogo devolve-se sempre, com ou sem pagamentos disponíveis -- a
    # vitrine tem de abrir em produção. A trava fica só na compra, abaixo.
    return LojaDiamantesPublica(
        pacotes=[
            PacoteDiamantesPublico(
                id=p.id,
                diamantes=p.diamantes,
                bonus=p.bonus,
                total_diamantes=p.total_diamantes,
                preco_kz=p.preco_kz,
                preco_moedas=p.preco_moedas,
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
        return servico.comprar(utilizador.id, dados.pacote_id, dados.metodo_pagamento)
    except PacoteInexistenteError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="pacote de diamantes inexistente")
    except MoedasInsuficientesError:
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail="moedas insuficientes")
    except PagamentosIndisponiveisError:
        # 501 e não 503: não é uma avaria passageira, é uma funcionalidade
        # que ainda não existe -- o frontend mostra "disponíveis em breve".
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="pagamentos reais disponíveis em breve",
        )


@router.post(
    "/jogo/loja/pedidos", response_model=PedidoDiamantesPublico, status_code=status.HTTP_201_CREATED
)
def pedir_diamantes_kwanzas(
    dados: PedirDiamantesKwanzasRequest,
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    servico: LojaJogoService = Depends(obter_loja_jogo_service),
) -> PedidoDiamantesRegisto:
    """Kwanzas por transferência: grava o pedido com o comprovativo. Não
    credita nada -- só quando um admin confirmar o pagamento."""
    try:
        return servico.pedir_com_kwanzas(utilizador.id, dados.pacote_id, dados.comprovativo_chave)
    except PacoteInexistenteError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="pacote de diamantes inexistente")
    except ChaveDeComprovativoInvalidaError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="essa chave não é um comprovativo válido")


@router.get("/jogo/loja/pedidos", response_model=list[PedidoDiamantesPublico])
def listar_meus_pedidos_diamantes(
    utilizador: UtilizadorRegisto = Depends(obter_utilizador_atual),
    servico: LojaJogoService = Depends(obter_loja_jogo_service),
) -> list[PedidoDiamantesRegisto]:
    return servico.listar_pedidos_do_utilizador(utilizador.id)


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
        categoria=dados.categoria,
    )


@router.get(
    "/admin/jogo/pedidos-diamantes",
    response_model=list[PedidoDiamantesAdmin],
    dependencies=[Depends(obter_utilizador_admin)],
)
def listar_pedidos_diamantes(
    servico: LojaJogoService = Depends(obter_loja_jogo_service),
) -> list[PedidoDiamantesRegisto]:
    return servico.listar_pedidos()


@router.post("/admin/jogo/pedidos-diamantes/{pedido_id}/aprovar", response_model=PedidoDiamantesAdmin)
def aprovar_pedido_diamantes(
    pedido_id: str,
    admin: UtilizadorRegisto = Depends(obter_utilizador_admin),
    servico: LojaJogoService = Depends(obter_loja_jogo_service),
) -> PedidoDiamantesRegisto:
    """Pagamento confirmado pelo admin: credita os diamantes, uma única vez."""
    try:
        return servico.aprovar_pedido(pedido_id, admin.id).pedido
    except PedidoDiamantesNaoEncontradoError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="pedido não encontrado")
    except PedidoDiamantesJaDecididoError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="este pedido já foi decidido")
    except PedidoDiamantesSemContaError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="o pedido não está ligado a uma conta — não há a quem creditar",
        )


@router.post("/admin/jogo/pedidos-diamantes/{pedido_id}/rejeitar", response_model=PedidoDiamantesAdmin)
def rejeitar_pedido_diamantes(
    pedido_id: str,
    admin: UtilizadorRegisto = Depends(obter_utilizador_admin),
    servico: LojaJogoService = Depends(obter_loja_jogo_service),
) -> PedidoDiamantesRegisto:
    try:
        return servico.rejeitar_pedido(pedido_id, admin.id)
    except PedidoDiamantesNaoEncontradoError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="pedido não encontrado")
    except PedidoDiamantesJaDecididoError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="este pedido já foi decidido")
