"""Testes da regra de decisão do rastreio (motor próprio, docs/MOTOR_ANALISE_RASTREIO.md §7).

A regra decide o resultado clínico a partir das medições, por isso vive na API,
com versão e testes (CLAUDE.md §3 e §8). Os limiares são provisórios até à fase
V3 (estudo clínico); os testes fixam o comportamento, não os números finais.
"""

import pytest

from app.services.classificacao_rastreio_service import (
    DESVIO_MAXIMO_PLAUSIVEL_DELTA,
    DISPERSAO_MAXIMA_DELTA,
    FOTOGRAFIAS_VALIDAS_MINIMAS,
    LIMIAR_HORIZONTAL_DELTA,
    LIMIAR_VERTICAL_DELTA,
    VERSAO_REGRA,
    MedicoesRastreio,
    classificar,
)


def medicoes(**over) -> MedicoesRastreio:
    base = {
        "horizontal_delta": 1.0,
        "vertical_delta": 0.5,
        "dispersao_delta": 1.0,
        "fotografias_validas": 3,
        "fotografias_total": 3,
        "falha": None,
        "versao_motor": "jpa-hirschberg/1",
    }
    base.update(over)
    return MedicoesRastreio(**base)


class TestClassificar:
    def test_sem_desvio_e_sem_sinais(self) -> None:
        r = classificar(medicoes())
        assert r.conclusao == "sem_sinais"
        assert r.versao_regra == VERSAO_REGRA

    @pytest.mark.parametrize("h", [LIMIAR_HORIZONTAL_DELTA, -LIMIAR_HORIZONTAL_DELTA, 15.0, -30.0])
    def test_desvio_horizontal_no_limiar_ou_acima_encaminha(self, h: float) -> None:
        r = classificar(medicoes(horizontal_delta=h))
        assert r.conclusao == "encaminhar"
        assert r.motivo == "desvio-horizontal"

    def test_desvio_horizontal_logo_abaixo_do_limiar_nao_encaminha(self) -> None:
        assert classificar(medicoes(horizontal_delta=LIMIAR_HORIZONTAL_DELTA - 0.1)).conclusao == "sem_sinais"

    def test_desvio_vertical_encaminha(self) -> None:
        r = classificar(medicoes(vertical_delta=-LIMIAR_VERTICAL_DELTA))
        assert r.conclusao == "encaminhar"
        assert r.motivo == "desvio-vertical"

    def test_o_limiar_provisorio_fica_abaixo_dos_8_delta_da_aapos(self) -> None:
        # Enquanto não houver estudo clínico, aceitam-se mais falsos positivos
        # para perder menos casos (docs/MOTOR_ANALISE_RASTREIO.md §8).
        assert LIMIAR_HORIZONTAL_DELTA < 8
        assert LIMIAR_VERTICAL_DELTA < 8


class TestNaoMediu:
    """Sem medição fiável nunca se diz 'sem sinais': diz-se que não se mediu."""

    def test_falha_do_motor(self) -> None:
        r = classificar(medicoes(falha="sem-reflexo", fotografias_validas=0))
        assert r.conclusao == "nao_mediu"
        assert r.motivo == "sem-reflexo"

    def test_poucas_fotografias_validas(self) -> None:
        r = classificar(medicoes(fotografias_validas=FOTOGRAFIAS_VALIDAS_MINIMAS - 1))
        assert r.conclusao == "nao_mediu"
        assert r.motivo == "poucas-fotografias-validas"

    def test_fotografias_que_discordam(self) -> None:
        r = classificar(medicoes(dispersao_delta=DISPERSAO_MAXIMA_DELTA + 0.1, horizontal_delta=12))
        assert r.conclusao == "nao_mediu"
        assert r.motivo == "medicoes-inconsistentes"

    def test_valor_impossivel_nao_e_tratado_como_desvio(self) -> None:
        r = classificar(medicoes(horizontal_delta=DESVIO_MAXIMO_PLAUSIVEL_DELTA + 1))
        assert r.conclusao == "nao_mediu"
        assert r.motivo == "medicao-implausivel"

    @pytest.mark.parametrize("campo", ["horizontal_delta", "vertical_delta", "dispersao_delta"])
    def test_numero_invalido_nao_mediu(self, campo: str) -> None:
        assert classificar(medicoes(**{campo: float("nan")})).conclusao == "nao_mediu"


class TestRegistoCompativel:
    def test_traduz_para_o_diagnostico_que_a_tabela_ja_guarda(self) -> None:
        # "não mediu" nunca se grava como "normal" (bug do fluxo antigo): grava-se
        # "inconclusivo" (2026-10-07, decisão do dono do projecto).
        assert classificar(medicoes(horizontal_delta=20)).diagnostico_registo == "requer_avaliacao"
        assert classificar(medicoes()).diagnostico_registo == "normal"
        assert classificar(medicoes(falha="sem-reflexo", fotografias_validas=0)).diagnostico_registo == "inconclusivo"
