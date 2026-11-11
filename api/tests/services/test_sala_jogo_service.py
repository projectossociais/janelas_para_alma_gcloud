from dataclasses import replace
from datetime import UTC, date, datetime, timedelta

import pytest

from app.repositories.jogo_repository import PerguntaJogoRegisto
from app.repositories.sala_jogo_repository import (
    Alteracao,
    JogadorSalaRegisto,
    MensagemSalaRegisto,
    SalaRegisto,
)
from app.services.jogo_service import SemPerguntasError
from app.services.sala_jogo_service import (
    AUSENCIA_MAXIMA,
    BONUS_MAXIMO_RAPIDEZ,
    BONUS_VITORIA,
    LIMITE_DIARIO_MOEDAS,
    MAXIMO_DE_MENSAGENS_POR_JOGADOR,
    MAXIMO_DESEMPATES,
    MOEDAS_POR_ACERTO,
    PONTOS_POR_ACERTO,
    RONDAS,
    TEMPO_DE_REVELACAO,
    TEMPO_POR_PERGUNTA,
    TOLERANCIA_DE_REDE,
    VALIDADE_DA_ESPERA,
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
    e_adulto,
    normalizar_codigo,
    primeiro_nome,
)

HOJE = date(2026, 11, 10)


class RepositorioPerguntasFalso:
    """Perguntas por nível; a certa é sempre a "B"."""

    def __init__(self, quantas: int = 20) -> None:
        self.perguntas = [
            PerguntaJogoRegisto(
                id=f"p{nivel}-{i}",
                texto_pergunta=f"Pergunta {i} do nível {nivel}?",
                opcao_a="a",
                opcao_b="b",
                opcao_c="c",
                opcao_d="d",
                resposta_correta="B",
                nivel_dificuldade=nivel,
                explicacao="porque sim",
            )
            for nivel in (1, 2, 3)
            for i in range(quantas)
        ]

    def obter_aleatoria_fora_de(self, nivel_dificuldade: int, excluir_ids: tuple[str, ...] = ()):
        return next(
            (p for p in self.perguntas if p.nivel_dificuldade == nivel_dificuldade and p.id not in excluir_ids),
            None,
        )

    def obter_por_id(self, pergunta_id: str):
        return next((p for p in self.perguntas if p.id == pergunta_id), None)


class RepositorioSalasFalso:
    """Mesma semântica do real: `atualizar` aplica a função ao estado actual
    e, se houver prémios, credita-os com o tecto diário."""

    def __init__(self) -> None:
        self.salas: dict[str, SalaRegisto] = {}
        self.mensagens: dict[str, list[MensagemSalaRegisto]] = {}
        self.denuncias: list[tuple[str, str]] = []
        self.moedas: dict[str, int] = {}
        self._proximo = 1

    def criar(self, codigo: str, anfitriao: JogadorSalaRegisto, agora: datetime) -> SalaRegisto | None:
        if codigo in self.salas:
            return None
        sala = SalaRegisto(
            id=f"sala-{self._proximo}",
            codigo=codigo,
            anfitriao_id=anfitriao.utilizador_id,
            estado="a_aguardar",
            criada_em=agora,
            atualizada_em=agora,
            jogadores=(anfitriao,),
        )
        self._proximo += 1
        self.salas[codigo] = sala
        return sala

    def obter(self, codigo: str) -> SalaRegisto | None:
        return self.salas.get(codigo)

    def atualizar(self, codigo: str, funcao) -> SalaRegisto | None:
        atual = self.salas.get(codigo)
        if atual is None:
            return None
        alteracao: Alteracao | None = funcao(atual)
        if alteracao is None:
            return atual
        nova = alteracao.sala
        if alteracao.premios:
            dia = (nova.terminada_em or nova.atualizada_em).date()
            jogadores = []
            for jogador in nova.jogadores:
                premio = dict(alteracao.premios)[jogador.utilizador_id]
                hoje = sum(
                    (j.moedas_ganhas or 0)
                    for s in self.salas.values()
                    if s.codigo != codigo and s.terminada_em is not None and s.terminada_em.date() == dia
                    for j in s.jogadores
                    if j.utilizador_id == jogador.utilizador_id
                )
                creditadas = max(0, min(premio, alteracao.limite_diario - hoje))
                self.moedas[jogador.utilizador_id] = self.moedas.get(jogador.utilizador_id, 0) + creditadas
                jogadores.append(replace(jogador, moedas_sem_limite=premio, moedas_ganhas=creditadas))
            nova = replace(nova, jogadores=tuple(jogadores))
        self.salas[codigo] = nova
        return nova

    def codigos_abertos_de(self, utilizador_id: str) -> list[str]:
        return [
            s.codigo
            for s in self.salas.values()
            if s.estado in ("a_aguardar", "em_curso") and any(j.utilizador_id == utilizador_id for j in s.jogadores)
        ]

    def adicionar_mensagem(self, sala_id: str, utilizador_id: str, texto: str, agora: datetime):
        mensagem = MensagemSalaRegisto(
            id=f"m{len(self.mensagens.get(sala_id, [])) + 1}", utilizador_id=utilizador_id, texto=texto, criada_em=agora
        )
        self.mensagens.setdefault(sala_id, []).append(mensagem)
        return mensagem

    def listar_mensagens(self, sala_id: str, limite: int):
        return self.mensagens.get(sala_id, [])[-limite:]

    def mensagens_de(self, sala_id: str, utilizador_id: str):
        return [m.criada_em for m in self.mensagens.get(sala_id, []) if m.utilizador_id == utilizador_id]

    def registar_denuncia(self, sala_id: str, denunciante_id: str, agora: datetime) -> None:
        self.denuncias.append((sala_id, denunciante_id))


class NotificadorFalso:
    def __init__(self) -> None:
        self.avisos: list[tuple[str, str]] = []

    def notificar(self, titulo: str, mensagem: str) -> None:
        self.avisos.append((titulo, mensagem))


class Relogio:
    def __init__(self) -> None:
        self.agora = datetime(2026, 11, 10, 12, 0, tzinfo=UTC)

    def __call__(self) -> datetime:
        return self.agora

    def passar(self, **kwargs) -> None:
        self.agora += timedelta(**kwargs)


ANA = Participante("ana", "Ana", adulto=True)
RUI = Participante("rui", "Rui", adulto=True)
ZE = Participante("ze", "Zé", adulto=True)
MIUDO = Participante("miudo", "Kiala", adulto=False)


class Cenario:
    def __init__(self) -> None:
        self.salas = RepositorioSalasFalso()
        self.perguntas = RepositorioPerguntasFalso()
        self.notificador = NotificadorFalso()
        self.relogio = Relogio()
        self.codigos = iter(f"SALA{i:02d}" for i in range(1, 99))
        self.servico = SalaJogoService(
            self.salas, self.perguntas, self.notificador, self.relogio, lambda: next(self.codigos)
        )

    def sala_a_dois(self, a: Participante = ANA, b: Participante = RUI) -> str:
        codigo = self.servico.criar(a).sala.codigo
        self.servico.entrar(codigo, b)
        return codigo

    def em_jogo(self, a: Participante = ANA, b: Participante = RUI) -> str:
        codigo = self.sala_a_dois(a, b)
        self.servico.comecar(codigo, a.utilizador_id)
        return codigo

    def ronda(self, codigo: str, respostas: dict[str, str | None], segundos: dict[str, int] | None = None) -> None:
        """Joga a ronda em curso (resposta `None` = não responde) e avança
        até à pergunta seguinte ou ao fim."""
        sala = self.salas.salas[codigo]
        pergunta = sala.pergunta_atual_id
        inicio = self.relogio.agora
        for utilizador, resposta in sorted(respostas.items(), key=lambda par: (segundos or {}).get(par[0], 1)):
            if resposta is None:
                continue
            self.relogio.agora = inicio + timedelta(seconds=(segundos or {}).get(utilizador, 1))
            self.servico.responder(codigo, utilizador, pergunta, resposta)
        if any(r is None for r in respostas.values()):
            # Os aparelhos continuam a perguntar pelo estado enquanto esperam
            # (sem isso contava como ausência).
            fim = inicio + TEMPO_POR_PERGUNTA + TOLERANCIA_DE_REDE + timedelta(seconds=1)
            while self.relogio.agora < fim:
                self.relogio.agora = min(fim, self.relogio.agora + timedelta(seconds=4))
                for utilizador in respostas:
                    self.servico.estado(codigo, utilizador)
        self.relogio.passar(seconds=TEMPO_DE_REVELACAO.total_seconds())
        for utilizador in respostas:
            self.servico.estado(codigo, utilizador)


@pytest.fixture
def c() -> Cenario:
    return Cenario()


# --- Funções puras -------------------------------------------------------------


@pytest.mark.parametrize(
    ("nascimento", "faixa", "esperado"),
    [
        (date(1990, 5, 1), None, True),
        (date(1990, 5, 1), "18_39", True),
        (date(2008, 11, 10), None, True),  # faz 18 hoje
        (date(2008, 11, 11), None, False),  # faz 18 amanhã
        (date(2015, 1, 1), None, False),
        (None, None, False),  # sem data de nascimento não há chat
        (None, "18_39", False),
        (date(1990, 5, 1), "6_12", False),  # conta de adulto usada por uma criança
        (date(1990, 5, 1), "13_17", False),
        (date(1990, 5, 1), "ate_5", False),
    ],
)
def test_e_adulto(nascimento, faixa, esperado) -> None:
    assert e_adulto(nascimento, faixa, HOJE) is esperado


def test_primeiro_nome_nunca_leva_apelido_nem_fica_vazio() -> None:
    assert primeiro_nome("Ana Maria dos Santos", "Jogador") == "Ana"
    assert primeiro_nome("  ", "Jogador") == "Jogador"
    assert primeiro_nome(None, "Jogador") == "Jogador"


def test_normalizar_codigo() -> None:
    assert normalizar_codigo(" ab-c2 3x ") == "ABC23X"


# --- Entrar e sair -------------------------------------------------------------


def test_criar_abre_uma_sala_a_aguardar_com_o_anfitriao(c) -> None:
    vista = c.servico.criar(ANA)

    assert vista.sala.estado == "a_aguardar"
    assert vista.sala.anfitriao_id == "ana"
    assert [j.nome for j in vista.sala.jogadores] == ["Ana"]


def test_criar_sorteia_outro_codigo_se_o_primeiro_ja_existir(c) -> None:
    c.servico.criar(ANA)
    c.codigos = iter(["SALA01", "SALA01", "NOVO22"])

    assert c.servico.criar(RUI).sala.codigo == "NOVO22"


def test_entrar_pelo_codigo_mesmo_escrito_em_minusculas(c) -> None:
    codigo = c.servico.criar(ANA).sala.codigo

    vista = c.servico.entrar(codigo.lower(), RUI)

    assert [j.nome for j in vista.sala.jogadores] == ["Ana", "Rui"]


def test_entrar_outra_vez_na_mesma_sala_nao_duplica(c) -> None:
    codigo = c.sala_a_dois()

    assert len(c.servico.entrar(codigo, RUI).sala.jogadores) == 2


def test_sala_cheia_inexistente_expirada_ou_ja_comecada(c) -> None:
    codigo = c.sala_a_dois()
    with pytest.raises(SalaCheiaError):
        c.servico.entrar(codigo, ZE)
    with pytest.raises(SalaNaoEncontradaError):
        c.servico.entrar("NAOHA1", ZE)

    c.servico.comecar(codigo, "ana")
    with pytest.raises(SalaJaComecouError):
        c.servico.entrar(codigo, ZE)

    velha = c.servico.criar(ZE).sala.codigo
    c.relogio.passar(seconds=VALIDADE_DA_ESPERA.total_seconds() + 1)
    with pytest.raises(SalaNaoEncontradaError):
        c.servico.entrar(velha, MIUDO)


def test_quem_nao_esta_na_sala_nao_a_ve(c) -> None:
    codigo = c.em_jogo()
    pergunta = c.salas.salas[codigo].pergunta_atual_id

    with pytest.raises(SalaNaoEncontradaError):
        c.servico.estado(codigo, "ze")
    with pytest.raises(SalaNaoEncontradaError):
        c.servico.responder(codigo, "ze", pergunta, "B")
    with pytest.raises(SalaNaoEncontradaError):
        c.servico.comecar(codigo, "ze")
    with pytest.raises(SalaNaoEncontradaError):
        c.servico.enviar_mensagem(codigo, "ze", "olá")


def test_uma_pessoa_so_esta_numa_sala_de_cada_vez(c) -> None:
    antiga = c.servico.criar(ANA).sala.codigo
    do_rui = c.servico.criar(RUI).sala.codigo

    c.servico.entrar(do_rui, ANA)

    assert c.salas.salas[antiga].estado == "abandonada"
    assert c.salas.codigos_abertos_de("ana") == [do_rui]


def test_sair_antes_de_comecar(c) -> None:
    codigo = c.sala_a_dois()

    c.servico.sair(codigo, "rui")
    assert [j.utilizador_id for j in c.salas.salas[codigo].jogadores] == ["ana"]
    assert c.salas.salas[codigo].estado == "a_aguardar"

    c.servico.sair(codigo, "ana")
    assert c.salas.salas[codigo].estado == "abandonada"


# --- Começar -------------------------------------------------------------------


def test_so_o_anfitriao_comeca_e_so_com_dois(c) -> None:
    codigo = c.servico.criar(ANA).sala.codigo
    with pytest.raises(FaltaJogadorError):
        c.servico.comecar(codigo, "ana")
    c.servico.entrar(codigo, RUI)
    with pytest.raises(SoAnfitriaoError):
        c.servico.comecar(codigo, "rui")

    vista = c.servico.comecar(codigo, "ana")

    assert vista.sala.estado == "em_curso"
    assert (vista.sala.fase, vista.sala.ronda, vista.sala.desempate) == ("pergunta", 1, 0)
    assert vista.sala.prazo_resposta == c.relogio.agora + TEMPO_POR_PERGUNTA
    assert vista.pergunta is not None and vista.pergunta.nivel_dificuldade == 1


def test_comecar_duas_vezes_nao_muda_a_pergunta(c) -> None:
    codigo = c.em_jogo()
    primeira = c.salas.salas[codigo].pergunta_atual_id

    assert c.servico.comecar(codigo, "ana").sala.pergunta_atual_id == primeira


def test_sem_perguntas_nao_comeca(c) -> None:
    codigo = c.sala_a_dois()
    c.perguntas.perguntas = []
    with pytest.raises(SemPerguntasError):
        c.servico.comecar(codigo, "ana")
    assert c.salas.salas[codigo].estado == "a_aguardar"


# --- Responder -----------------------------------------------------------------


def test_a_ronda_so_fecha_com_as_duas_respostas(c) -> None:
    codigo = c.em_jogo()
    pergunta = c.salas.salas[codigo].pergunta_atual_id

    c.relogio.passar(seconds=3)
    depois_da_ana = c.servico.responder(codigo, "ana", pergunta, "B")
    assert depois_da_ana.sala.fase == "pergunta"
    assert [j.respondeu_em is not None for j in depois_da_ana.sala.jogadores] == [True, False]
    assert all(j.certa_ronda is None for j in depois_da_ana.sala.jogadores)

    c.relogio.passar(seconds=12)
    depois_do_rui = c.servico.responder(codigo, "rui", pergunta, "C")
    ana, rui = depois_do_rui.sala.jogadores
    assert depois_do_rui.sala.fase == "revelacao"
    assert (ana.certa_ronda, rui.certa_ronda) == (True, False)
    assert ana.pontos == PONTOS_POR_ACERTO + round(BONUS_MAXIMO_RAPIDEZ * 27 / 30)
    assert (rui.pontos, rui.acertos, ana.acertos) == (0, 0, 1)


def test_quem_responde_mais_depressa_ganha_mais_pontos(c) -> None:
    codigo = c.em_jogo()
    c.ronda(codigo, {"ana": "B", "rui": "B"}, segundos={"ana": 2, "rui": 20})
    ana, rui = c.salas.salas[codigo].jogadores

    assert ana.pontos > rui.pontos > PONTOS_POR_ACERTO - 1


@pytest.mark.parametrize("caso", ["outra_pergunta", "duas_vezes", "fora_de_prazo", "na_revelacao"])
def test_respostas_fora_da_ronda_sao_recusadas(c, caso) -> None:
    codigo = c.em_jogo()
    pergunta = c.salas.salas[codigo].pergunta_atual_id
    if caso == "outra_pergunta":
        pergunta = "p3-9"
    elif caso == "duas_vezes":
        c.servico.responder(codigo, "ana", pergunta, "A")
    elif caso == "fora_de_prazo":
        c.relogio.passar(seconds=(TEMPO_POR_PERGUNTA + TOLERANCIA_DE_REDE).total_seconds() + 1)
    else:
        c.servico.responder(codigo, "rui", pergunta, "B")
        c.servico.responder(codigo, "ana", pergunta, "B")
        pontos = c.salas.salas[codigo].jogadores[0].pontos
    with pytest.raises(RondaFechadaError):
        c.servico.responder(codigo, "ana", pergunta, "B")
    if caso == "na_revelacao":
        assert c.salas.salas[codigo].jogadores[0].pontos == pontos


def test_uma_resposta_mesmo_no_fim_ainda_conta_mas_sem_bonus(c) -> None:
    codigo = c.em_jogo()
    pergunta = c.salas.salas[codigo].pergunta_atual_id
    c.relogio.passar(seconds=TEMPO_POR_PERGUNTA.total_seconds() + 1)

    c.servico.responder(codigo, "ana", pergunta, "B")
    c.servico.responder(codigo, "rui", pergunta, "A")

    assert c.salas.salas[codigo].jogadores[0].pontos == PONTOS_POR_ACERTO


def test_passado_o_prazo_a_ronda_fecha_sozinha_e_quem_nao_respondeu_fica_a_zero(c) -> None:
    codigo = c.em_jogo()
    pergunta = c.salas.salas[codigo].pergunta_atual_id
    c.servico.responder(codigo, "ana", pergunta, "B")
    c.relogio.passar(seconds=20)
    assert c.servico.estado(codigo, "ana").sala.fase == "pergunta"

    c.relogio.passar(seconds=13)
    vista = c.servico.estado(codigo, "rui")

    ana, rui = vista.sala.jogadores
    assert vista.sala.fase == "revelacao"
    assert (ana.certa_ronda, rui.certa_ronda, rui.pontos_ronda) == (True, False, 0)


# --- Rondas, fim e prémios -----------------------------------------------------


def test_depois_da_revelacao_vem_a_ronda_seguinte_mais_dificil_e_sem_repetir(c) -> None:
    codigo = c.em_jogo()
    niveis, vistas = [], []
    for ronda in range(1, RONDAS + 1):
        sala = c.salas.salas[codigo]
        assert sala.ronda == ronda
        vistas.append(sala.pergunta_atual_id)
        niveis.append(c.perguntas.obter_por_id(sala.pergunta_atual_id).nivel_dificuldade)
        c.ronda(codigo, {"ana": "B", "rui": "A"})

    assert niveis == [1, 1, 2, 3, 3]
    assert len(set(vistas)) == RONDAS


def test_a_revelacao_dura_o_seu_tempo(c) -> None:
    codigo = c.em_jogo()
    pergunta = c.salas.salas[codigo].pergunta_atual_id
    c.servico.responder(codigo, "ana", pergunta, "B")
    c.servico.responder(codigo, "rui", pergunta, "B")

    c.relogio.passar(seconds=TEMPO_DE_REVELACAO.total_seconds() - 1)
    assert c.servico.estado(codigo, "ana").sala.fase == "revelacao"
    c.relogio.passar(seconds=1)
    vista = c.servico.estado(codigo, "ana")
    assert (vista.sala.fase, vista.sala.ronda) == ("pergunta", 2)
    assert all(j.respondeu_em is None and j.resposta_ronda is None for j in vista.sala.jogadores)


def test_partida_completa_tem_vencedor_e_paga_as_duas_contas(c) -> None:
    codigo = c.em_jogo()
    for ronda in range(RONDAS):
        c.ronda(codigo, {"ana": "B", "rui": "B" if ronda < 2 else "A"})

    sala = c.salas.salas[codigo]
    ana, rui = sala.jogadores
    assert (sala.estado, sala.motivo_fim, sala.vencedores) == ("terminada", "completa", ("ana",))
    assert ana.moedas_ganhas == RONDAS * MOEDAS_POR_ACERTO + BONUS_VITORIA
    assert rui.moedas_ganhas == 2 * MOEDAS_POR_ACERTO
    assert c.salas.moedas == {"ana": 80, "rui": 20}


def test_ver_o_estado_depois_do_fim_nao_paga_outra_vez(c) -> None:
    codigo = c.em_jogo()
    for _ in range(RONDAS):
        c.ronda(codigo, {"ana": "B", "rui": "A"})
    antes = dict(c.salas.moedas)

    for _ in range(3):
        c.relogio.passar(seconds=10)
        c.servico.estado(codigo, "ana")
        c.servico.estado(codigo, "rui")

    assert c.salas.moedas == antes


def test_empate_vai_a_desempate_e_sem_decisao_a_vitoria_e_partilhada(c) -> None:
    codigo = c.em_jogo()
    for _ in range(RONDAS):
        c.ronda(codigo, {"ana": None, "rui": None})
    sala = c.salas.salas[codigo]
    assert (sala.estado, sala.desempate, sala.ronda) == ("em_curso", 1, RONDAS)
    assert c.perguntas.obter_por_id(sala.pergunta_atual_id).nivel_dificuldade == 3

    for _ in range(MAXIMO_DESEMPATES):
        c.ronda(codigo, {"ana": None, "rui": None})

    sala = c.salas.salas[codigo]
    assert (sala.estado, sala.vencedores) == ("terminada", ("ana", "rui"))
    assert [j.moedas_ganhas for j in sala.jogadores] == [BONUS_VITORIA // 2, BONUS_VITORIA // 2]


def test_o_desempate_acaba_assim_que_um_passa_a_frente(c) -> None:
    codigo = c.em_jogo()
    for _ in range(RONDAS):
        c.ronda(codigo, {"ana": None, "rui": None})

    c.ronda(codigo, {"ana": "A", "rui": "B"})

    assert c.salas.salas[codigo].vencedores == ("rui",)


def test_sair_a_meio_e_desistencia_o_outro_ganha_so_os_seus_acertos(c) -> None:
    codigo = c.em_jogo()
    c.ronda(codigo, {"ana": "B", "rui": "B"})
    c.ronda(codigo, {"ana": "B", "rui": "B"})

    c.servico.sair(codigo, "rui")

    sala = c.salas.salas[codigo]
    assert (sala.estado, sala.motivo_fim, sala.vencedores) == ("terminada", "desistencia", ("ana",))
    assert c.salas.moedas == {"ana": 2 * MOEDAS_POR_ACERTO, "rui": 0}


def test_quem_fica_sem_dar_sinal_perde_por_desistencia(c) -> None:
    codigo = c.em_jogo()
    for _ in range(6):
        c.relogio.passar(seconds=4)
        c.servico.estado(codigo, "ana")
    assert c.salas.salas[codigo].estado == "em_curso"

    c.relogio.passar(seconds=4)
    vista = c.servico.estado(codigo, "ana")

    assert (vista.sala.estado, vista.sala.motivo_fim, vista.sala.vencedores) == ("terminada", "desistencia", ("ana",))


def test_se_ninguem_da_sinal_ha_muito_tempo_a_sala_morre_sem_premio(c) -> None:
    codigo = c.em_jogo()
    c.ronda(codigo, {"ana": "B", "rui": "B"})
    c.relogio.passar(seconds=AUSENCIA_MAXIMA.total_seconds() + 60)

    vista = c.servico.estado(codigo, "rui")

    assert vista.sala.estado == "abandonada"
    assert vista.sala.vencedores == ()
    assert c.salas.moedas == {}


def test_limite_diario_de_moedas_por_conta(c) -> None:
    por_partida = RONDAS * MOEDAS_POR_ACERTO + BONUS_VITORIA
    partidas = LIMITE_DIARIO_MOEDAS // por_partida + 1
    for _ in range(partidas):
        codigo = c.em_jogo()
        for _ in range(RONDAS):
            c.ronda(codigo, {"ana": "B", "rui": "A"})

    ultima = c.salas.salas[codigo].jogadores[0]
    assert c.salas.moedas["ana"] == LIMITE_DIARIO_MOEDAS
    assert ultima.moedas_sem_limite == por_partida
    assert ultima.moedas_ganhas == LIMITE_DIARIO_MOEDAS - (partidas - 1) * por_partida

    c.relogio.passar(days=1)
    codigo = c.em_jogo()
    for _ in range(RONDAS):
        c.ronda(codigo, {"ana": "B", "rui": "A"})
    assert c.salas.salas[codigo].jogadores[0].moedas_ganhas == por_partida


# --- Chat ----------------------------------------------------------------------


def test_chat_so_existe_com_os_dois_jogadores_adultos(c) -> None:
    sozinha = c.servico.criar(ANA)
    assert (sozinha.chat_disponivel, sozinha.chat_motivo) == (False, "a_espera")

    a_dois = c.servico.entrar(sozinha.sala.codigo, RUI)
    assert (a_dois.chat_disponivel, a_dois.chat_motivo) == (True, None)


@pytest.mark.parametrize(("a", "b"), [(ANA, MIUDO), (MIUDO, ANA), (MIUDO, replace(MIUDO, utilizador_id="outro"))])
def test_com_um_menor_na_sala_ninguem_tem_chat(c, a, b) -> None:
    codigo = c.sala_a_dois(a, b)

    vista = c.servico.estado(codigo, a.utilizador_id)
    assert (vista.chat_disponivel, vista.chat_motivo) == (False, "so_adultos")
    for quem in (a, b):
        with pytest.raises(ChatIndisponivelError) as erro:
            c.servico.enviar_mensagem(codigo, quem.utilizador_id, "olá")
        assert erro.value.motivo == "so_adultos"
    assert c.salas.mensagens == {}


def test_mensagem_normal_chega_aos_dois(c) -> None:
    codigo = c.sala_a_dois()

    c.servico.enviar_mensagem(codigo, "ana", "  Boa   sorte! ")

    vista = c.servico.estado(codigo, "rui")
    assert [(m.utilizador_id, m.texto) for m in vista.mensagens] == [("ana", "Boa sorte!")]


@pytest.mark.parametrize(
    ("texto", "motivo"),
    [
        ("és uma merda", "linguagem"),
        ("o meu número é 923456789", "contacto"),
        ("adiciona-me no whatsapp", "contacto"),
        ("onde moras?", "dados_pessoais"),
        ("   ", "vazia"),
        ("a" * 300, "comprida"),
    ],
)
def test_o_filtro_recusa_a_mensagem_e_nada_fica_gravado(c, texto, motivo) -> None:
    codigo = c.sala_a_dois()

    with pytest.raises(MensagemRecusadaError) as erro:
        c.servico.enviar_mensagem(codigo, "ana", texto)

    assert erro.value.motivo == motivo
    assert c.salas.mensagens == {}


def test_limite_de_ritmo_e_de_mensagens_por_jogador(c) -> None:
    codigo = c.sala_a_dois()
    c.servico.enviar_mensagem(codigo, "ana", "olá")
    with pytest.raises(MensagemDepressaDemaisError):
        c.servico.enviar_mensagem(codigo, "ana", "olá outra vez")
    # O ritmo é por jogador: o Rui pode responder logo.
    c.servico.enviar_mensagem(codigo, "rui", "olá")

    for _ in range(MAXIMO_DE_MENSAGENS_POR_JOGADOR - 1):
        c.relogio.passar(seconds=3)
        c.servico.enviar_mensagem(codigo, "ana", "boa")
    c.relogio.passar(seconds=3)
    with pytest.raises(MensagemRecusadaError) as erro:
        c.servico.enviar_mensagem(codigo, "ana", "mais uma")
    assert erro.value.motivo == "limite"


def test_denuncia_fecha_o_chat_esconde_as_mensagens_e_avisa_os_admins_uma_vez(c) -> None:
    codigo = c.sala_a_dois()
    c.servico.enviar_mensagem(codigo, "rui", "olá")

    vista = c.servico.denunciar(codigo, "ana")
    c.servico.denunciar(codigo, "rui")

    assert (vista.chat_disponivel, vista.chat_motivo, vista.mensagens) == (False, "denunciado", ())
    assert c.servico.estado(codigo, "rui").mensagens == ()
    with pytest.raises(ChatIndisponivelError):
        c.servico.enviar_mensagem(codigo, "rui", "desculpa")
    # As mensagens ficam guardadas para um admin as poder ver.
    assert len(c.salas.mensagens["sala-1"]) == 1
    assert c.salas.denuncias == [("sala-1", "ana")]
    assert len(c.notificador.avisos) == 1
    assert codigo in c.notificador.avisos[0][1]


def test_denunciar_numa_sala_sem_chat_nao_faz_nada(c) -> None:
    codigo = c.sala_a_dois(ANA, MIUDO)
    with pytest.raises(ChatIndisponivelError):
        c.servico.denunciar(codigo, "ana")
    assert c.notificador.avisos == []


def test_o_chat_fecha_algum_tempo_depois_do_fim_da_partida(c) -> None:
    codigo = c.em_jogo()
    c.servico.sair(codigo, "rui")
    c.servico.enviar_mensagem(codigo, "ana", "bom jogo")

    c.relogio.passar(minutes=11)

    with pytest.raises(ChatIndisponivelError) as erro:
        c.servico.enviar_mensagem(codigo, "ana", "ainda aí?")
    assert erro.value.motivo == "fechado"
