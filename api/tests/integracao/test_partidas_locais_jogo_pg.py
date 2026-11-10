"""Partidas do Multijogador Local contra um Postgres real: o SQL das
transições condicionais e o tecto diário com a linha do perfil bloqueada."""

import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.repositories.jogo_repository import SQLAlchemyPerguntaJogoRepository
from app.repositories.orm_models import PerguntaJogo, RespostaOpcao, Utilizador
from app.repositories.partida_local_jogo_repository import SQLAlchemyPartidaLocalJogoRepository
from app.repositories.perfil_jogador_repository import SQLAlchemyPerfilJogadorRepository
from app.services.jogo_local_service import (
    LIMITE_DIARIO_MOEDAS,
    MOEDAS_POR_ACERTO,
    RONDAS,
    JogoLocalService,
    PartidaLocalNaoEncontradaError,
    PartidaLocalTerminadaError,
    PerguntaForaDaPartidaLocalError,
)

AGORA = datetime(2026, 11, 10, 12, 0, tzinfo=UTC)


def _utilizador(sessao: Session) -> str:
    u = Utilizador(email=f"{uuid.uuid4().hex}@example.com", password_hash="x", papel="estrabico")
    sessao.add(u)
    sessao.commit()
    return str(u.id)


def _perguntas(sessao: Session, por_nivel: int = 30) -> None:
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
                )
            )
    sessao.commit()


def _servico(sessao: Session, agora: datetime = AGORA) -> JogoLocalService:
    return JogoLocalService(
        SQLAlchemyPerguntaJogoRepository(sessao),
        SQLAlchemyPerfilJogadorRepository(sessao),
        SQLAlchemyPartidaLocalJogoRepository(sessao),
        relogio=lambda: agora,
    )


def _jogar(servico: JogoLocalService, utilizador: str, jogadores: int, acertos: int) -> str:
    partida = servico.iniciar(utilizador, jogadores)
    vistas = set()
    for i in range(jogadores * RONDAS):
        pergunta = servico.nova_pergunta(utilizador, partida.id, (i % 15) + 1)
        assert pergunta.id not in vistas
        vistas.add(pergunta.id)
        servico.responder(utilizador, partida.id, pergunta.id, "B" if i < acertos else "A")
    return partida.id


def test_partida_completa_credita_as_moedas_uma_vez(sessao_pg) -> None:
    _perguntas(sessao_pg)
    utilizador = _utilizador(sessao_pg)
    servico = _servico(sessao_pg)
    partida = _jogar(servico, utilizador, jogadores=2, acertos=7)

    terminada = servico.terminar(utilizador, partida)

    assert terminada.moedas_ganhas == 7 * MOEDAS_POR_ACERTO
    assert terminada.perfil.moedas == 7 * MOEDAS_POR_ACERTO
    assert terminada.perfil.moedas_ganhas_total == 7 * MOEDAS_POR_ACERTO
    try:
        servico.terminar(utilizador, partida)
        raise AssertionError("a segunda vez devia ser recusada")
    except PartidaLocalTerminadaError:
        pass
    perfil = SQLAlchemyPerfilJogadorRepository(sessao_pg).obter_ou_criar(utilizador)
    assert perfil.moedas == 7 * MOEDAS_POR_ACERTO


def test_resposta_repetida_e_ids_que_nao_sao_uuid(sessao_pg) -> None:
    _perguntas(sessao_pg)
    utilizador = _utilizador(sessao_pg)
    servico = _servico(sessao_pg)
    partida = servico.iniciar(utilizador, 2)
    pergunta = servico.nova_pergunta(utilizador, partida.id, 1)
    assert servico.nova_pergunta(utilizador, partida.id, 12).id == pergunta.id
    assert servico.responder(utilizador, partida.id, pergunta.id, "B").correta is True

    for pergunta_id in (pergunta.id, "nao-e-uuid"):
        try:
            servico.responder(utilizador, partida.id, pergunta_id, "B")
            raise AssertionError("devia ser recusada")
        except PerguntaForaDaPartidaLocalError:
            pass
    try:
        servico.terminar(utilizador, "nao-e-uuid")
        raise AssertionError("devia ser recusada")
    except PartidaLocalNaoEncontradaError:
        pass


def test_uma_so_partida_em_curso_por_conta(sessao_pg) -> None:
    _perguntas(sessao_pg)
    utilizador = _utilizador(sessao_pg)
    servico = _servico(sessao_pg)
    primeira = servico.iniciar(utilizador, 2)
    segunda = servico.iniciar(utilizador, 2)

    repo = SQLAlchemyPartidaLocalJogoRepository(sessao_pg)
    assert repo.obter(primeira.id, utilizador).estado == "terminada"
    assert repo.obter(primeira.id, utilizador).moedas_ganhas == 0
    assert repo.obter(segunda.id, utilizador).estado == "em_curso"


def test_limite_diario_e_novo_dia(sessao_pg) -> None:
    _perguntas(sessao_pg)
    utilizador = _utilizador(sessao_pg)
    servico = _servico(sessao_pg)
    for _ in range(4):
        assert servico.terminar(utilizador, _jogar(servico, utilizador, 2, 10)).moedas_ganhas == 100

    acima = servico.terminar(utilizador, _jogar(servico, utilizador, 2, 10))
    assert acima.moedas_ganhas == 0
    assert acima.limite_diario_atingido is True
    assert acima.perfil.moedas == LIMITE_DIARIO_MOEDAS

    amanha = _servico(sessao_pg, AGORA + timedelta(days=1))
    assert amanha.terminar(utilizador, _jogar(amanha, utilizador, 2, 10)).moedas_ganhas == 100


def test_perfil_criado_em_simultaneo_nao_rebenta(sessao_pg) -> None:
    """Dois pedidos a criar o mesmo perfil de jogo ao mesmo tempo: o segundo
    fica com o do primeiro (antes, rebentava com violação de unicidade)."""
    utilizador = _utilizador(sessao_pg)
    motor = sessao_pg.get_bind()

    def criar() -> str:
        with Session(motor) as s:
            return SQLAlchemyPerfilJogadorRepository(s).obter_ou_criar(utilizador).id

    with ThreadPoolExecutor(max_workers=8) as executor:
        ids = list(executor.map(lambda _: criar(), range(8)))

    assert len(set(ids)) == 1


def test_terminar_em_simultaneo_paga_uma_so_vez(sessao_pg) -> None:
    _perguntas(sessao_pg)
    utilizador = _utilizador(sessao_pg)
    partida = _jogar(_servico(sessao_pg), utilizador, 2, 10)
    motor = sessao_pg.get_bind()

    def terminar() -> int | None:
        with Session(motor) as s:
            try:
                return _servico(s).terminar(utilizador, partida).moedas_ganhas
            except PartidaLocalTerminadaError:
                return None

    with ThreadPoolExecutor(max_workers=6) as executor:
        resultados = list(executor.map(lambda _: terminar(), range(6)))

    assert sorted(r for r in resultados if r is not None) == [100]
    sessao_pg.expire_all()
    assert SQLAlchemyPerfilJogadorRepository(sessao_pg).obter_ou_criar(utilizador).moedas == 100
