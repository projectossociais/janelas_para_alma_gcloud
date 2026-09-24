"""Testes do `EstatisticasJogadorService` -- nível do jogador e estatísticas
por categoria para o Perfil."""

from dataclasses import replace

import pytest

from app.repositories.estatisticas_jogo_repository import EstatisticaCategoriaRegisto
from app.repositories.orm_models import CATEGORIAS_PERGUNTA_JOGO
from app.services.estatisticas_jogador_service import (
    NIVEIS,
    EstatisticasJogadorService,
    calcular_nivel,
)
from tests.services.test_jogo_service import RepositorioPerfisFalso


class EstatisticasFalsas:
    def __init__(self, linhas: list[EstatisticaCategoriaRegisto]) -> None:
        self._linhas = linhas

    def listar_por_categoria(self, utilizador_id: str) -> list[EstatisticaCategoriaRegisto]:
        return self._linhas


@pytest.mark.parametrize(
    ("total", "numero", "nivel_id"),
    [
        (0, 1, "iniciante"),
        (15, 1, "iniciante"),
        (16, 2, "aprendiz"),
        (45, 2, "aprendiz"),
        (46, 3, "conhecedor"),
        (90, 3, "conhecedor"),
        (91, 4, "especialista"),
        (150, 4, "especialista"),
        (151, 5, "mestre_visao"),
        (10_000, 5, "mestre_visao"),
    ],
)
def test_niveis_pelos_patamares_superados_no_total(total, numero, nivel_id) -> None:
    progresso = calcular_nivel(total)
    assert (progresso.nivel.numero, progresso.nivel.id) == (numero, nivel_id)


def test_progresso_ate_ao_nivel_seguinte() -> None:
    meio = calcular_nivel(8)  # iniciante: 0 -> 16
    assert meio.proximo_minimo == 16
    assert meio.progresso == pytest.approx(0.5)
    inicio_aprendiz = calcular_nivel(16)
    assert (inicio_aprendiz.proximo_minimo, inicio_aprendiz.progresso) == (46, 0.0)


def test_ultimo_nivel_sem_proximo_e_progresso_completo() -> None:
    mestre = calcular_nivel(200)
    assert mestre.proximo_minimo is None
    assert mestre.progresso == 1.0


def test_valor_negativo_conta_como_zero() -> None:
    assert calcular_nivel(-5).nivel.numero == 1


def test_niveis_sao_crescentes_e_comecam_em_zero() -> None:
    minimos = [n.minimo for n in NIVEIS]
    assert minimos[0] == 0 and minimos == sorted(minimos) and len(set(minimos)) == len(minimos)


def test_obter_devolve_sempre_as_6_categorias_pela_ordem_oficial() -> None:
    perfis = RepositorioPerfisFalso()
    servico = EstatisticasJogadorService(
        perfis, EstatisticasFalsas([EstatisticaCategoriaRegisto("ciencia_ocular", 4, 3)])
    )

    estatisticas = servico.obter("u-1")

    assert [c.categoria for c in estatisticas.categorias] == list(CATEGORIAS_PERGUNTA_JOGO)
    ciencia = next(c for c in estatisticas.categorias if c.categoria == "ciencia_ocular")
    assert (ciencia.respostas, ciencia.acertos, ciencia.taxa_acerto) == (4, 3, 0.75)
    anatomia = next(c for c in estatisticas.categorias if c.categoria == "anatomia_ocular")
    assert (anatomia.respostas, anatomia.taxa_acerto) == (0, 0.0)


def test_obter_calcula_o_nivel_pelo_total_do_perfil() -> None:
    perfis = RepositorioPerfisFalso()
    perfis._perfis["u-1"] = replace(perfis.obter_ou_criar("u-1"), patamares_superados_total=50)
    estatisticas = EstatisticasJogadorService(perfis, EstatisticasFalsas([])).obter("u-1")
    assert estatisticas.nivel.nivel.id == "conhecedor"
    assert estatisticas.perfil.patamares_superados_total == 50
