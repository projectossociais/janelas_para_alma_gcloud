"""A reserva de perguntas que a migração `e5b1c8d2a4f7` e o `JogoService`
semeiam -- sem base de dados. A idempotência contra um Postgres real corre
no CI, a seguir ao `alembic upgrade head` (ver `.github/workflows/ci.yml`)."""

from collections import Counter

from app.repositories.orm_models import CATEGORIA_PERGUNTA_POR_OMISSAO, CATEGORIAS_PERGUNTA_JOGO
from app.repositories.reserva_perguntas_jogo import CATEGORIA_POR_OMISSAO, CATEGORIAS, PERGUNTAS


def test_categorias_espelham_as_do_modelo_orm() -> None:
    # A reserva não importa o ORM (a migração não pode depender dele) --
    # este teste é o que impede as duas listas de divergirem.
    assert CATEGORIAS == CATEGORIAS_PERGUNTA_JOGO
    assert CATEGORIA_POR_OMISSAO == CATEGORIA_PERGUNTA_POR_OMISSAO


def test_225_perguntas_75_por_nivel() -> None:
    assert len(PERGUNTAS) == 225
    assert Counter(p.nivel_dificuldade for p in PERGUNTAS) == {1: 75, 2: 75, 3: 75}


def test_textos_unicos_porque_o_seed_procura_pelo_texto() -> None:
    assert len({p.texto_pergunta for p in PERGUNTAS}) == len(PERGUNTAS)


def test_campos_validos_para_as_restricoes_da_tabela() -> None:
    for p in PERGUNTAS:
        assert p.categoria in CATEGORIAS, p.texto_pergunta
        assert p.resposta_correta in {"A", "B", "C", "D"}, p.texto_pergunta
        assert all([p.opcao_a, p.opcao_b, p.opcao_c, p.opcao_d, p.explicacao]), p.texto_pergunta


def test_as_6_categorias_estao_representadas() -> None:
    assert {p.categoria for p in PERGUNTAS} == set(CATEGORIAS)
