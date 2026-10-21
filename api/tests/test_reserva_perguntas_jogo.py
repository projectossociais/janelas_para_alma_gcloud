"""A reserva de perguntas que a migração `e5b1c8d2a4f7` e o `JogoService`
semeiam -- sem base de dados. A idempotência contra um Postgres real corre
no CI, a seguir ao `alembic upgrade head` (ver `.github/workflows/ci.yml`)."""

import math
from collections import Counter
from statistics import mean

import pytest

from app.repositories.orm_models import CATEGORIA_PERGUNTA_POR_OMISSAO, CATEGORIAS_PERGUNTA_JOGO
from app.repositories.reserva_perguntas_jogo import (
    CATEGORIA_POR_OMISSAO,
    CATEGORIAS,
    PERGUNTAS,
    RARIDADE_MEDIA_POR_NIVEL,
    RARIDADES_PERMITIDAS_POR_NIVEL,
)


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


# --- Dificuldade equilibrada ---------------------------------------------------


def _opcoes(p) -> list[str]:
    return [p.opcao_a, p.opcao_b, p.opcao_c, p.opcao_d]


def _palavras(texto: str) -> int:
    return len(texto.split())


def test_linguagem_simples_em_todos_os_niveis() -> None:
    # Pergunta até 20 palavras; opções até 8 e com 3 de diferença no máximo --
    # opções em frase completa eram a principal queixa dos jogadores.
    for p in PERGUNTAS:
        n = [_palavras(o) for o in _opcoes(p)]
        assert _palavras(p.texto_pergunta) <= 20, p.texto_pergunta
        assert max(n) <= 8 and max(n) - min(n) <= 3, (p.texto_pergunta, n)


def test_a_certa_raramente_e_a_opcao_mais_comprida() -> None:
    def certa(p) -> str:
        return getattr(p, f"opcao_{p.resposta_correta.lower()}")

    mais_longa = [
        p for p in PERGUNTAS if all(o == certa(p) or len(o) < len(certa(p)) for o in _opcoes(p))
    ]
    # Ao acaso seria 1/4; acima de 40% já é uma pista.
    assert len(mais_longa) / len(PERGUNTAS) <= 0.40


def _alvo(patamar: int) -> float:
    return 1 + 4 * math.lgamma(patamar + 1) / math.lgamma(16)


def test_medias_por_nivel_sao_as_da_curva_ln_fatorial() -> None:
    for nivel, media in RARIDADE_MEDIA_POR_NIVEL.items():
        patamares = range((nivel - 1) * 5 + 1, nivel * 5 + 1)
        assert media == pytest.approx(mean(_alvo(n) for n in patamares), abs=0.005)
        # Os degraus permitidos cabem sempre entre o do primeiro e o do último patamar.
        assert RARIDADES_PERMITIDAS_POR_NIVEL[nivel] <= set(
            range(math.floor(_alvo(patamares[0])), math.ceil(_alvo(patamares[-1])) + 1)
        )


@pytest.mark.parametrize("nivel", [1, 2, 3])
def test_raridade_de_cada_nivel_segue_a_curva(nivel: int) -> None:
    raridades = [p.raridade for p in PERGUNTAS if p.nivel_dificuldade == nivel]
    assert set(raridades) <= RARIDADES_PERMITIDAS_POR_NIVEL[nivel]
    assert mean(raridades) == pytest.approx(RARIDADE_MEDIA_POR_NIVEL[nivel], abs=0.15)
