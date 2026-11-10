"""Regras do Multijogador Online do "Inclusivamente": duas pessoas, cada uma
no seu aparelho, na mesma sala (entra-se por código -- nunca com
desconhecidos sorteados).

Formato igual ao do modo local: `RONDAS` rondas de dificuldade crescente,
os dois respondem à mesma pergunta ao mesmo tempo, pontos por acerto e
rapidez, até `MAXIMO_DESEMPATES` rondas de desempate e, sem decisão, vitória
partilhada.

O servidor decide tudo o que alguém podia querer inventar (CLAUDE.md §3):
a pergunta, o prazo (relógio do servidor, nunca o do aparelho), se a
resposta está certa, os pontos e o prémio. A resposta certa só sai depois de
a ronda fechar, e a resposta do adversário também -- antes disso só se vê
que "já respondeu".

Não há relógio a correr no servidor: o estado avança quando um dos aparelhos
pergunta por ele (de segundo a segundo) ou responde. Cada avanço é uma
função pura (estado -> estado novo) aplicada pelo repositório com a linha da
sala bloqueada, por isso dois pedidos em simultâneo nunca avançam duas vezes.

**Prémio** (criado em 2026-11-10, a pedido do dono do projecto): cada
jogador recebe `MOEDAS_POR_ACERTO` por resposta certa sua e o vencedor mais
`BONUS_VITORIA` (metade a cada um numa vitória partilhada), até
`LIMITE_DIARIO_MOEDAS` por dia UTC e por conta -- o tecto existe porque duas
contas combinadas podiam fabricar moedas. Quem desiste não recebe nada; quem
fica recebe só os seus acertos. Sem diamantes.

**Chat** (decisão do dono do projecto, 2026-11-10: só para adultos, com
filtros): só existe quando os **dois** jogadores são adultos (`e_adulto`).
Cada mensagem passa por `filtro_chat.avaliar_mensagem`; há limite de
mensagens e de ritmo; uma denúncia fecha o chat da sala e avisa os admins.
"""

import secrets
from collections.abc import Callable
from dataclasses import dataclass, replace
from datetime import UTC, date, datetime, timedelta
from typing import Protocol

from app.repositories.jogo_repository import PerguntaJogoRegisto, nivel_dificuldade_do_patamar
from app.repositories.sala_jogo_repository import (
    Alteracao,
    JogadorSalaRegisto,
    MensagemSalaRegisto,
    SalaJogoRepository,
    SalaRegisto,
)
from app.services.filtro_chat import avaliar_mensagem
from app.services.jogo_service import SemPerguntasError

JOGADORES_POR_SALA = 2
RONDAS = 5
MAXIMO_DESEMPATES = 3
PATAMARES_DAS_RONDAS = (2, 5, 8, 11, 14)
PATAMAR_DO_DESEMPATE = 15

TEMPO_POR_PERGUNTA = timedelta(seconds=30)
# Uma resposta enviada mesmo no fim ainda pode vir a caminho.
TOLERANCIA_DE_REDE = timedelta(seconds=1)
TEMPO_DE_REVELACAO = timedelta(seconds=6)

PONTOS_POR_ACERTO = 100
BONUS_MAXIMO_RAPIDEZ = 50

MOEDAS_POR_ACERTO = 10
BONUS_VITORIA = 30
LIMITE_DIARIO_MOEDAS = 300

# Uma sala à espera do segundo jogador vale meia hora.
VALIDADE_DA_ESPERA = timedelta(minutes=30)
# Sem sinal de vida há mais do que isto, em jogo, conta como desistência.
AUSENCIA_MAXIMA = timedelta(seconds=25)
# O sinal de vida só se regrava de tantos em tantos segundos.
INTERVALO_DO_SINAL = timedelta(seconds=5)

MAXIMO_DE_MENSAGENS_POR_JOGADOR = 40
INTERVALO_ENTRE_MENSAGENS = timedelta(seconds=2)
MENSAGENS_MOSTRADAS = 50
CHAT_DEPOIS_DO_FIM = timedelta(minutes=10)

IDADE_ADULTA = 18
_FAIXAS_DE_CRIANCA = frozenset({"ate_5", "6_12", "13_17"})
# Sem letras e algarismos que se confundem a ditar o código (0/O, 1/I/L).
_ALFABETO_DO_CODIGO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
TAMANHO_DO_CODIGO = 6


class SalaNaoEncontradaError(Exception):
    """Não existe, expirou, ou quem pede não está nela (não se distingue)."""


class SalaCheiaError(Exception):
    pass


class SalaJaComecouError(Exception):
    pass


class SoAnfitriaoError(Exception):
    pass


class FaltaJogadorError(Exception):
    pass


class RondaFechadaError(Exception):
    """A resposta chegou fora da ronda: outra pergunta, já respondida, ou
    depois do prazo."""


class ChatIndisponivelError(Exception):
    def __init__(self, motivo: str) -> None:
        super().__init__(motivo)
        self.motivo = motivo


class MensagemRecusadaError(Exception):
    def __init__(self, motivo: str) -> None:
        super().__init__(motivo)
        self.motivo = motivo


class MensagemDepressaDemaisError(Exception):
    pass


class PerguntasDaSalaRepository(Protocol):
    def obter_aleatoria_fora_de(
        self, nivel_dificuldade: int, excluir_ids: tuple[str, ...] = ()
    ) -> PerguntaJogoRegisto | None: ...
    def obter_por_id(self, pergunta_id: str) -> PerguntaJogoRegisto | None: ...


class Notificador(Protocol):
    def notificar(self, titulo: str, mensagem: str) -> None: ...


@dataclass(frozen=True)
class Participante:
    """Quem entra numa sala: o id da sessão, o primeiro nome e se é adulto."""

    utilizador_id: str
    nome: str
    adulto: bool


@dataclass(frozen=True)
class VistaDaSala:
    """Tudo o que o router precisa para responder a um jogador."""

    sala: SalaRegisto
    agora: datetime
    pergunta: PerguntaJogoRegisto | None
    chat_disponivel: bool
    chat_motivo: str | None
    mensagens: tuple[MensagemSalaRegisto, ...]


def e_adulto(data_nascimento: date | None, faixa_etaria: str | None, hoje: date) -> bool:
    """Adulto para efeitos do chat: data de nascimento no perfil com 18 anos
    feitos, e a faixa etária do perfil visual (de quem faz os exercícios) não
    é de criança -- as contas são de adultos, mas uma criança pode usar a do
    representante legal. Sem data de nascimento, não é adulto: na dúvida,
    não há chat. É uma declaração do próprio, não uma prova de idade."""
    if data_nascimento is None or faixa_etaria in _FAIXAS_DE_CRIANCA:
        return False
    idade = hoje.year - data_nascimento.year - ((hoje.month, hoje.day) < (data_nascimento.month, data_nascimento.day))
    return idade >= IDADE_ADULTA


def primeiro_nome(nome_completo: str | None, por_omissao: str) -> str:
    """Só o primeiro nome vai para a sala -- nunca o apelido nem o email."""
    partes = (nome_completo or "").split()
    return partes[0][:20] if partes else por_omissao


def gerar_codigo() -> str:
    return "".join(secrets.choice(_ALFABETO_DO_CODIGO) for _ in range(TAMANHO_DO_CODIGO))


def normalizar_codigo(codigo: str) -> str:
    return "".join(c for c in codigo.upper() if c.isalnum())[:TAMANHO_DO_CODIGO]


def pontos_da_resposta(certa: bool, respondeu_em: datetime | None, prazo: datetime) -> int:
    if not certa or respondeu_em is None:
        return 0
    fracao = (prazo - respondeu_em) / TEMPO_POR_PERGUNTA
    return PONTOS_POR_ACERTO + round(BONUS_MAXIMO_RAPIDEZ * max(0.0, min(1.0, fracao)))


def estado_do_chat(sala: SalaRegisto, agora: datetime) -> tuple[bool, str | None]:
    """Se o chat da sala está disponível e, se não, porquê."""
    if sala.chat_bloqueado:
        return False, "denunciado"
    if len(sala.jogadores) < JOGADORES_POR_SALA:
        return False, "a_espera"
    if not all(j.adulto for j in sala.jogadores):
        return False, "so_adultos"
    if sala.estado == "abandonada" or (
        sala.estado == "terminada" and sala.terminada_em is not None and agora - sala.terminada_em > CHAT_DEPOIS_DO_FIM
    ):
        return False, "fechado"
    return True, None


class SalaJogoService:
    def __init__(
        self,
        salas: SalaJogoRepository,
        perguntas: PerguntasDaSalaRepository,
        notificador: Notificador | None = None,
        relogio: Callable[[], datetime] = lambda: datetime.now(UTC),
        gerador_de_codigo: Callable[[], str] = gerar_codigo,
    ) -> None:
        self._salas = salas
        self._perguntas = perguntas
        self._notificador = notificador
        self._relogio = relogio
        self._gerar_codigo = gerador_de_codigo

    # --- Entrar e sair -------------------------------------------------------

    def criar(self, participante: Participante) -> VistaDaSala:
        agora = self._relogio()
        self._sair_das_outras(participante.utilizador_id, manter=None)
        anfitriao = JogadorSalaRegisto(
            utilizador_id=participante.utilizador_id,
            ordem=1,
            nome=participante.nome,
            adulto=participante.adulto,
            visto_em=agora,
        )
        for _ in range(8):
            sala = self._salas.criar(self._gerar_codigo(), anfitriao, agora)
            if sala is not None:
                return self._vista(sala, participante.utilizador_id, agora)
        raise RuntimeError("não foi possível gerar um código de sala livre")

    def entrar(self, codigo: str, participante: Participante) -> VistaDaSala:
        agora = self._relogio()
        codigo = normalizar_codigo(codigo)
        self._sair_das_outras(participante.utilizador_id, manter=codigo)

        def passo(sala: SalaRegisto) -> Alteracao | None:
            if _jogador(sala, participante.utilizador_id) is not None:
                return None  # já cá está (voltou a abrir o link)
            if sala.estado == "abandonada" or (
                sala.estado == "a_aguardar" and agora - sala.criada_em > VALIDADE_DA_ESPERA
            ):
                raise SalaNaoEncontradaError()
            if sala.estado != "a_aguardar":
                raise SalaJaComecouError()
            if len(sala.jogadores) >= JOGADORES_POR_SALA:
                raise SalaCheiaError()
            novo = JogadorSalaRegisto(
                utilizador_id=participante.utilizador_id,
                ordem=max(j.ordem for j in sala.jogadores) + 1,
                nome=participante.nome,
                adulto=participante.adulto,
                visto_em=agora,
            )
            return Alteracao(replace(sala, jogadores=(*sala.jogadores, novo), atualizada_em=agora))

        sala = self._salas.atualizar(codigo, passo)
        if sala is None:
            raise SalaNaoEncontradaError()
        return self._vista(sala, participante.utilizador_id, agora)

    def sair(self, codigo: str, utilizador_id: str) -> None:
        agora = self._relogio()

        def passo(sala: SalaRegisto) -> Alteracao | None:
            if _jogador(sala, utilizador_id) is None:
                return None
            if sala.estado == "a_aguardar":
                if sala.anfitriao_id == utilizador_id:
                    return Alteracao(replace(sala, estado="abandonada", terminada_em=agora, atualizada_em=agora))
                restantes = tuple(j for j in sala.jogadores if j.utilizador_id != utilizador_id)
                return Alteracao(replace(sala, jogadores=restantes, atualizada_em=agora))
            if sala.estado == "em_curso":
                return self._terminar_por_desistencia(sala, utilizador_id, agora)
            return None

        self._salas.atualizar(normalizar_codigo(codigo), passo)

    def _sair_das_outras(self, utilizador_id: str, manter: str | None) -> None:
        """Uma pessoa só está numa sala de cada vez."""
        for codigo in self._salas.codigos_abertos_de(utilizador_id):
            if codigo != manter:
                self.sair(codigo, utilizador_id)

    # --- Jogar ---------------------------------------------------------------

    def comecar(self, codigo: str, utilizador_id: str) -> VistaDaSala:
        agora = self._relogio()

        def passo(sala: SalaRegisto) -> Alteracao | None:
            if _jogador(sala, utilizador_id) is None:
                raise SalaNaoEncontradaError()
            if sala.estado != "a_aguardar":
                return None  # já começou (segundo toque): fica como está
            if sala.anfitriao_id != utilizador_id:
                raise SoAnfitriaoError()
            if len(sala.jogadores) < JOGADORES_POR_SALA:
                raise FaltaJogadorError()
            presentes = tuple(replace(j, visto_em=agora) for j in sala.jogadores)
            em_curso = replace(sala, estado="em_curso", jogadores=presentes)
            return Alteracao(self._nova_pergunta(em_curso, agora, ronda=1, desempate=0))

        sala = self._salas.atualizar(normalizar_codigo(codigo), passo)
        if sala is None:
            raise SalaNaoEncontradaError()
        return self._vista(sala, utilizador_id, agora)

    def estado(self, codigo: str, utilizador_id: str) -> VistaDaSala:
        """O estado da sala para um dos seus jogadores. É também o sinal de
        vida do aparelho, e o que faz a partida avançar quando um prazo passa."""
        agora = self._relogio()
        codigo = normalizar_codigo(codigo)

        def passo(sala: SalaRegisto) -> Alteracao | None:
            if _jogador(sala, utilizador_id) is None:
                raise SalaNaoEncontradaError()
            return self._avancar(sala, utilizador_id, agora)

        sala = self._salas.obter(codigo)
        if sala is None:
            raise SalaNaoEncontradaError()
        # Quase todos os pedidos não mudam nada: só se bloqueia a sala quando
        # este pedido tem mesmo alguma coisa para gravar.
        if passo(sala) is not None:
            sala = self._salas.atualizar(codigo, passo)
            if sala is None:
                raise SalaNaoEncontradaError()
        return self._vista(sala, utilizador_id, agora)

    def responder(self, codigo: str, utilizador_id: str, pergunta_id: str, resposta: str) -> VistaDaSala:
        agora = self._relogio()

        def passo(sala: SalaRegisto) -> Alteracao | None:
            jogador = _jogador(sala, utilizador_id)
            if jogador is None:
                raise SalaNaoEncontradaError()
            if (
                sala.estado != "em_curso"
                or sala.fase != "pergunta"
                or sala.pergunta_atual_id != pergunta_id
                or sala.prazo_resposta is None
                or jogador.respondeu_em is not None
                or agora > sala.prazo_resposta + TOLERANCIA_DE_REDE
            ):
                raise RondaFechadaError()
            # Responder também é sinal de vida.
            respondido = replace(
                jogador, resposta_ronda=resposta, respondeu_em=min(agora, sala.prazo_resposta), visto_em=agora
            )
            nova = _com_jogador(replace(sala, atualizada_em=agora), respondido)
            if all(j.respondeu_em is not None for j in nova.jogadores):
                nova = self._fechar_ronda(nova, agora)
            return Alteracao(nova)

        sala = self._salas.atualizar(normalizar_codigo(codigo), passo)
        if sala is None:
            raise SalaNaoEncontradaError()
        return self._vista(sala, utilizador_id, agora)

    # --- Avanço da partida (funções puras sobre o estado) --------------------

    def _avancar(self, sala: SalaRegisto, utilizador_id: str, agora: datetime) -> Alteracao | None:
        """O que este pedido tem de gravar, se alguma coisa: desistência por
        ausência, sinal de vida, fecho de ronda, ronda seguinte ou fim."""
        if sala.estado != "em_curso":
            return None
        eu = _jogador(sala, utilizador_id)
        assert eu is not None
        outros_ausentes = [
            j for j in sala.jogadores if j.utilizador_id != utilizador_id and agora - j.visto_em > AUSENCIA_MAXIMA
        ]
        if outros_ausentes:
            if agora - eu.visto_em > AUSENCIA_MAXIMA:
                # Ninguém aqui há muito tempo: a sala morre sem vencedor nem prémio.
                return Alteracao(
                    replace(sala, estado="abandonada", fase=None, terminada_em=agora, atualizada_em=agora)
                )
            return self._terminar_por_desistencia(sala, outros_ausentes[0].utilizador_id, agora)

        mudou = False
        if agora - eu.visto_em > INTERVALO_DO_SINAL:
            sala = _com_jogador(sala, replace(eu, visto_em=agora))
            mudou = True

        if sala.fase == "pergunta" and sala.prazo_resposta is not None:
            todos = all(j.respondeu_em is not None for j in sala.jogadores)
            if todos or agora > sala.prazo_resposta + TOLERANCIA_DE_REDE:
                return Alteracao(self._fechar_ronda(sala, agora))
        elif sala.fase == "revelacao" and sala.revelacao_ate is not None and agora >= sala.revelacao_ate:
            return self._depois_da_revelacao(sala, agora)
        return Alteracao(replace(sala, atualizada_em=agora)) if mudou else None

    def _nova_pergunta(self, sala: SalaRegisto, agora: datetime, ronda: int, desempate: int) -> SalaRegisto:
        patamar = PATAMAR_DO_DESEMPATE if desempate > 0 else PATAMARES_DAS_RONDAS[ronda - 1]
        nivel = nivel_dificuldade_do_patamar(patamar)
        pergunta = self._perguntas.obter_aleatoria_fora_de(
            nivel, sala.perguntas_entregues
        ) or self._perguntas.obter_aleatoria_fora_de(nivel)
        if pergunta is None:
            raise SemPerguntasError()
        limpos = tuple(
            replace(j, resposta_ronda=None, respondeu_em=None, certa_ronda=None, pontos_ronda=0)
            for j in sala.jogadores
        )
        return replace(
            sala,
            fase="pergunta",
            ronda=ronda,
            desempate=desempate,
            pergunta_atual_id=pergunta.id,
            perguntas_entregues=(*sala.perguntas_entregues, pergunta.id),
            prazo_resposta=agora + TEMPO_POR_PERGUNTA,
            revelacao_ate=None,
            jogadores=limpos,
            atualizada_em=agora,
        )

    def _fechar_ronda(self, sala: SalaRegisto, agora: datetime) -> SalaRegisto:
        assert sala.pergunta_atual_id is not None and sala.prazo_resposta is not None
        pergunta = self._perguntas.obter_por_id(sala.pergunta_atual_id)
        if pergunta is None:
            raise SemPerguntasError()
        avaliados = []
        for jogador in sala.jogadores:
            certa = jogador.resposta_ronda is not None and jogador.resposta_ronda == pergunta.resposta_correta
            pontos = pontos_da_resposta(certa, jogador.respondeu_em, sala.prazo_resposta)
            avaliados.append(
                replace(
                    jogador,
                    certa_ronda=certa,
                    pontos_ronda=pontos,
                    pontos=jogador.pontos + pontos,
                    acertos=jogador.acertos + (1 if certa else 0),
                )
            )
        return replace(
            sala,
            fase="revelacao",
            revelacao_ate=agora + TEMPO_DE_REVELACAO,
            jogadores=tuple(avaliados),
            atualizada_em=agora,
        )

    def _depois_da_revelacao(self, sala: SalaRegisto, agora: datetime) -> Alteracao:
        if sala.desempate == 0 and sala.ronda < RONDAS:
            return Alteracao(self._nova_pergunta(sala, agora, ronda=sala.ronda + 1, desempate=0))
        maximo = max(j.pontos for j in sala.jogadores)
        na_frente = tuple(j.utilizador_id for j in sala.jogadores if j.pontos == maximo)
        if len(na_frente) == 1 or sala.desempate >= MAXIMO_DESEMPATES:
            return self._terminar(sala, agora, vencedores=na_frente)
        return Alteracao(self._nova_pergunta(sala, agora, ronda=sala.ronda, desempate=sala.desempate + 1))

    def _terminar(self, sala: SalaRegisto, agora: datetime, vencedores: tuple[str, ...]) -> Alteracao:
        bonus = BONUS_VITORIA // len(vencedores)
        premios = tuple(
            (j.utilizador_id, j.acertos * MOEDAS_POR_ACERTO + (bonus if j.utilizador_id in vencedores else 0))
            for j in sala.jogadores
        )
        terminada = replace(
            sala,
            estado="terminada",
            fase=None,
            vencedores=vencedores,
            motivo_fim="completa",
            terminada_em=agora,
            atualizada_em=agora,
        )
        return Alteracao(terminada, premios=premios, limite_diario=LIMITE_DIARIO_MOEDAS)

    def _terminar_por_desistencia(self, sala: SalaRegisto, desistente_id: str, agora: datetime) -> Alteracao:
        """Quem sai (ou some) perde e não recebe nada; quem fica ganha e
        recebe só as moedas dos seus acertos, sem bónus de vitória."""
        ficam = tuple(j for j in sala.jogadores if j.utilizador_id != desistente_id)
        premios = tuple(
            (j.utilizador_id, j.acertos * MOEDAS_POR_ACERTO if j.utilizador_id != desistente_id else 0)
            for j in sala.jogadores
        )
        terminada = replace(
            sala,
            estado="terminada",
            fase=None,
            vencedores=tuple(j.utilizador_id for j in ficam),
            motivo_fim="desistencia",
            terminada_em=agora,
            atualizada_em=agora,
        )
        return Alteracao(terminada, premios=premios, limite_diario=LIMITE_DIARIO_MOEDAS)

    # --- Chat ----------------------------------------------------------------

    def enviar_mensagem(self, codigo: str, utilizador_id: str, texto: str) -> VistaDaSala:
        agora = self._relogio()
        sala = self._sala_do_jogador(codigo, utilizador_id)
        disponivel, motivo = estado_do_chat(sala, agora)
        if not disponivel:
            raise ChatIndisponivelError(motivo or "fechado")
        limpa, recusa = avaliar_mensagem(texto)
        if recusa is not None:
            raise MensagemRecusadaError(recusa)
        anteriores = self._salas.mensagens_de(sala.id, utilizador_id)
        if len(anteriores) >= MAXIMO_DE_MENSAGENS_POR_JOGADOR:
            raise MensagemRecusadaError("limite")
        if anteriores and agora - max(anteriores) < INTERVALO_ENTRE_MENSAGENS:
            raise MensagemDepressaDemaisError()
        self._salas.adicionar_mensagem(sala.id, utilizador_id, limpa, agora)
        return self._vista(sala, utilizador_id, agora)

    def denunciar(self, codigo: str, utilizador_id: str) -> VistaDaSala:
        """Fecha o chat da sala para os dois e avisa os admins. As mensagens
        ficam guardadas para poderem ser vistas."""
        agora = self._relogio()
        sala = self._sala_do_jogador(codigo, utilizador_id)
        if len(sala.jogadores) < JOGADORES_POR_SALA or not all(j.adulto for j in sala.jogadores):
            raise ChatIndisponivelError("so_adultos")
        ja_estava = sala.chat_bloqueado

        def passo(atual: SalaRegisto) -> Alteracao | None:
            if atual.chat_bloqueado:
                return None
            return Alteracao(replace(atual, chat_bloqueado=True, atualizada_em=agora))

        bloqueada = self._salas.atualizar(sala.codigo, passo)
        if bloqueada is None:
            raise SalaNaoEncontradaError()
        if not ja_estava:
            self._salas.registar_denuncia(sala.id, utilizador_id, agora)
            if self._notificador is not None:
                self._notificador.notificar(
                    "Denúncia no chat do jogo",
                    f"Um jogador denunciou o chat da sala {sala.codigo} do Multijogador Online. "
                    "O chat dessa sala foi fechado; as mensagens ficaram guardadas.",
                )
        return self._vista(bloqueada, utilizador_id, agora)

    # --- Leitura -------------------------------------------------------------

    def _sala_do_jogador(self, codigo: str, utilizador_id: str) -> SalaRegisto:
        sala = self._salas.obter(normalizar_codigo(codigo))
        if sala is None or _jogador(sala, utilizador_id) is None:
            raise SalaNaoEncontradaError()
        return sala

    def _vista(self, sala: SalaRegisto, utilizador_id: str, agora: datetime) -> VistaDaSala:
        pergunta = None
        if sala.estado == "em_curso" and sala.pergunta_atual_id is not None:
            pergunta = self._perguntas.obter_por_id(sala.pergunta_atual_id)
        disponivel, motivo = estado_do_chat(sala, agora)
        mensagens: tuple[MensagemSalaRegisto, ...] = ()
        # Depois de uma denúncia as mensagens deixam de se mostrar.
        if disponivel or motivo == "fechado":
            mensagens = tuple(self._salas.listar_mensagens(sala.id, MENSAGENS_MOSTRADAS))
        return VistaDaSala(
            sala=sala,
            agora=agora,
            pergunta=pergunta,
            chat_disponivel=disponivel,
            chat_motivo=motivo,
            mensagens=mensagens,
        )


def _jogador(sala: SalaRegisto, utilizador_id: str) -> JogadorSalaRegisto | None:
    return next((j for j in sala.jogadores if j.utilizador_id == utilizador_id), None)


def _com_jogador(sala: SalaRegisto, novo: JogadorSalaRegisto) -> SalaRegisto:
    return replace(
        sala, jogadores=tuple(novo if j.utilizador_id == novo.utilizador_id else j for j in sala.jogadores)
    )
