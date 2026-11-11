"""Salas do Multijogador Online contra um Postgres real: o SQL do
repositório, pedidos em simultâneo e o tecto diário de moedas."""

import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.repositories.eliminacao_conta_repository import SQLAlchemyEliminacaoContaRepository
from app.repositories.jogo_repository import SQLAlchemyPerguntaJogoRepository
from app.repositories.orm_models import (
    DenunciaChatJogo,
    JogadorSalaJogo,
    MensagemSalaJogo,
    PerguntaJogo,
    RespostaOpcao,
    Utilizador,
)
from app.repositories.perfil_jogador_repository import SQLAlchemyPerfilJogadorRepository
from app.repositories.sala_jogo_repository import SQLAlchemySalaJogoRepository
from app.services.sala_jogo_service import (
    BONUS_VITORIA,
    LIMITE_DIARIO_MOEDAS,
    MOEDAS_POR_ACERTO,
    RONDAS,
    TEMPO_DE_REVELACAO,
    Participante,
    RondaFechadaError,
    SalaCheiaError,
    SalaJogoService,
)


class Relogio:
    def __init__(self) -> None:
        self.agora = datetime(2026, 11, 10, 12, 0, tzinfo=UTC)

    def __call__(self) -> datetime:
        return self.agora


def _participante(sessao: Session, nome: str, adulto: bool = True) -> Participante:
    u = Utilizador(email=f"{uuid.uuid4().hex}@example.com", password_hash="x", papel="estrabico", nome_completo=nome)
    sessao.add(u)
    sessao.commit()
    return Participante(str(u.id), nome, adulto)


def _perguntas(sessao: Session, por_nivel: int = 12) -> None:
    for nivel in (1, 2, 3):
        for i in range(por_nivel):
            sessao.add(
                PerguntaJogo(
                    texto_pergunta=f"Pergunta {i} do nível {nivel}?",
                    opcao_a="a",
                    opcao_b="b",
                    opcao_c="c",
                    opcao_d="d",
                    resposta_correta=RespostaOpcao("B"),
                    nivel_dificuldade=nivel,
                    explicacao="porque sim",
                )
            )
    sessao.commit()


def _servico(sessao: Session, relogio: Relogio) -> SalaJogoService:
    return SalaJogoService(
        SQLAlchemySalaJogoRepository(sessao), SQLAlchemyPerguntaJogoRepository(sessao), None, relogio
    )


def _em_jogo(servico: SalaJogoService, a: Participante, b: Participante) -> str:
    codigo = servico.criar(a).sala.codigo
    servico.entrar(codigo, b)
    servico.comecar(codigo, a.utilizador_id)
    return codigo


def _partida(servico: SalaJogoService, relogio: Relogio, a: Participante, b: Participante) -> str:
    """Partida completa: `a` acerta sempre, `b` nunca."""
    codigo = _em_jogo(servico, a, b)
    for _ in range(RONDAS):
        pergunta = servico.estado(codigo, a.utilizador_id).sala.pergunta_atual_id
        servico.responder(codigo, a.utilizador_id, pergunta, "B")
        servico.responder(codigo, b.utilizador_id, pergunta, "A")
        relogio.agora += TEMPO_DE_REVELACAO + timedelta(seconds=1)
        servico.estado(codigo, a.utilizador_id)
    return codigo


def _moedas(sessao: Session, participante: Participante) -> int:
    sessao.expire_all()
    return SQLAlchemyPerfilJogadorRepository(sessao).obter_ou_criar(participante.utilizador_id).moedas


def test_partida_completa_grava_tudo_e_paga_as_duas_contas(sessao_pg) -> None:
    _perguntas(sessao_pg)
    relogio = Relogio()
    servico = _servico(sessao_pg, relogio)
    ana, rui = _participante(sessao_pg, "Ana"), _participante(sessao_pg, "Rui")

    codigo = _partida(servico, relogio, ana, rui)

    vista = servico.estado(codigo, rui.utilizador_id)
    assert (vista.sala.estado, vista.sala.motivo_fim) == ("terminada", "completa")
    assert vista.sala.vencedores == (ana.utilizador_id,)
    assert len(set(vista.sala.perguntas_entregues)) == RONDAS
    assert [j.acertos for j in vista.sala.jogadores] == [RONDAS, 0]
    assert _moedas(sessao_pg, ana) == RONDAS * MOEDAS_POR_ACERTO + BONUS_VITORIA
    assert _moedas(sessao_pg, rui) == 0
    # Ver o estado outra vez não paga outra vez.
    servico.estado(codigo, ana.utilizador_id)
    assert _moedas(sessao_pg, ana) == RONDAS * MOEDAS_POR_ACERTO + BONUS_VITORIA


def test_limite_diario_de_moedas(sessao_pg) -> None:
    _perguntas(sessao_pg)
    relogio = Relogio()
    servico = _servico(sessao_pg, relogio)
    ana, rui = _participante(sessao_pg, "Ana"), _participante(sessao_pg, "Rui")
    por_partida = RONDAS * MOEDAS_POR_ACERTO + BONUS_VITORIA

    for _ in range(LIMITE_DIARIO_MOEDAS // por_partida + 1):
        codigo = _partida(servico, relogio, ana, rui)

    assert _moedas(sessao_pg, ana) == LIMITE_DIARIO_MOEDAS
    ultima = servico.estado(codigo, ana.utilizador_id).sala.jogadores[0]
    assert ultima.moedas_sem_limite == por_partida
    assert ultima.moedas_ganhas < por_partida

    relogio.agora += timedelta(days=1)
    _partida(servico, relogio, ana, rui)
    assert _moedas(sessao_pg, ana) == LIMITE_DIARIO_MOEDAS + por_partida


def test_respostas_e_avancos_em_simultaneo_contam_uma_so_vez(sessao_pg) -> None:
    _perguntas(sessao_pg)
    relogio = Relogio()
    ana, rui = _participante(sessao_pg, "Ana"), _participante(sessao_pg, "Rui")
    codigo = _em_jogo(_servico(sessao_pg, relogio), ana, rui)
    motor = sessao_pg.get_bind()

    def em_paralelo(accoes):
        def correr(accao):
            with Session(motor) as s:
                try:
                    return accao(_servico(s, relogio))
                except RondaFechadaError:
                    return "recusada"

        with ThreadPoolExecutor(max_workers=len(accoes)) as executor:
            return list(executor.map(correr, accoes))

    for ronda in range(1, RONDAS + 1):
        pergunta = _servico(sessao_pg, relogio).estado(codigo, ana.utilizador_id).sala.pergunta_atual_id
        # Cada jogador envia a mesma resposta três vezes ao mesmo tempo.
        resultados = em_paralelo(
            [
                lambda s, u=u, r=r, p=pergunta: s.responder(codigo, u, p, r)
                for u, r in ((ana.utilizador_id, "B"), (rui.utilizador_id, "A"))
            ]
            * 3
        )
        assert resultados.count("recusada") == 4
        relogio.agora += TEMPO_DE_REVELACAO + timedelta(seconds=1)
        # Os dois aparelhos perguntam pelo estado ao mesmo tempo, várias vezes.
        em_paralelo([lambda s, u=u: s.estado(codigo, u) for u in (ana.utilizador_id, rui.utilizador_id)] * 4)
        sala = _servico(sessao_pg, relogio).estado(codigo, ana.utilizador_id).sala
        if ronda < RONDAS:
            assert (sala.ronda, sala.fase) == (ronda + 1, "pergunta")
            assert len(sala.perguntas_entregues) == ronda + 1

    assert sala.estado == "terminada"
    assert [j.acertos for j in sala.jogadores] == [RONDAS, 0]
    assert _moedas(sessao_pg, ana) == RONDAS * MOEDAS_POR_ACERTO + BONUS_VITORIA


def test_dois_a_entrar_ao_mesmo_tempo_so_um_fica_com_o_lugar(sessao_pg) -> None:
    relogio = Relogio()
    ana = _participante(sessao_pg, "Ana")
    candidatos = [_participante(sessao_pg, f"C{i}") for i in range(5)]
    codigo = _servico(sessao_pg, relogio).criar(ana).sala.codigo
    motor = sessao_pg.get_bind()

    def entrar(candidato: Participante) -> bool:
        with Session(motor) as s:
            try:
                _servico(s, relogio).entrar(codigo, candidato)
                return True
            except SalaCheiaError:
                return False

    with ThreadPoolExecutor(max_workers=5) as executor:
        resultados = list(executor.map(entrar, candidatos))

    assert resultados.count(True) == 1
    assert len(_servico(sessao_pg, relogio).estado(codigo, ana.utilizador_id).sala.jogadores) == 2


def test_chat_denuncia_e_anonimizacao(sessao_pg) -> None:
    relogio = Relogio()
    servico = _servico(sessao_pg, relogio)
    ana, rui = _participante(sessao_pg, "Ana"), _participante(sessao_pg, "Rui")
    codigo = servico.criar(ana).sala.codigo
    servico.entrar(codigo, rui)

    servico.enviar_mensagem(codigo, ana.utilizador_id, "Boa sorte!")
    relogio.agora += timedelta(seconds=3)
    servico.enviar_mensagem(codigo, rui.utilizador_id, "Igualmente")
    vista = servico.estado(codigo, ana.utilizador_id)
    assert [(m.utilizador_id, m.texto) for m in vista.mensagens] == [
        (ana.utilizador_id, "Boa sorte!"),
        (rui.utilizador_id, "Igualmente"),
    ]

    denunciada = servico.denunciar(codigo, ana.utilizador_id)
    assert (denunciada.chat_disponivel, denunciada.chat_motivo, denunciada.mensagens) == (False, "denunciado", ())
    sessao_pg.expire_all()
    assert len(sessao_pg.scalars(select(DenunciaChatJogo)).all()) == 1
    assert len(sessao_pg.scalars(select(MensagemSalaJogo)).all()) == 2

    # Anonimizar a conta do Rui apaga o que ele escreveu e o nome na sala.
    SQLAlchemyEliminacaoContaRepository(sessao_pg).anonimizar(
        rui.utilizador_id, relogio.agora, "anon@invalido.example", "x", "Conta eliminada"
    )
    sessao_pg.expire_all()
    restantes = sessao_pg.scalars(select(MensagemSalaJogo)).all()
    assert [str(m.utilizador_id) for m in restantes] == [ana.utilizador_id]
    nomes = {str(j.utilizador_id): j.nome for j in sessao_pg.scalars(select(JogadorSalaJogo))}
    assert nomes == {ana.utilizador_id: "Ana", rui.utilizador_id: "Conta eliminada"}
