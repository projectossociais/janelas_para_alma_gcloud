"""O modelo de certeza do Consultório -- as regras de personalidade de cada
profissional (categoria + patamar), a variação determinista por pergunta e
o comportamento sobre as 225 perguntas reais da reserva."""

from statistics import mean

import pytest

from app.repositories.reserva_perguntas_jogo import CATEGORIAS, PERGUNTAS
from app.services.certeza_consultorio import (
    CERTEZA_MAXIMA,
    CERTEZA_MINIMA,
    PERFIS,
    VARIACAO_MAXIMA_PP,
    calcular_certeza,
    certeza_sem_variacao,
    faixa_do_patamar,
    variacao_deterministica,
)
from app.services.mercado_jogo_service import VENDEDORES

PATAMARES = range(1, 16)
FUNDAMENTOS, INTERMEDIO, FIM_DE_JOGO = range(1, 6), range(6, 11), range(11, 16)
JOAO, MARTA, PAULO, HELENA = "estudante-medicina", "enfermeira-oftalmica", "optometrista", "oftalmologista"


def _sem_variacao(profissional: str, categoria: str, patamar: int) -> float:
    return certeza_sem_variacao(PERFIS[profissional], categoria, patamar)


def _ids(n: int = 40) -> list[str]:
    return [f"pergunta-{i}" for i in range(n)]


# --- Estrutura -------------------------------------------------------------


def test_um_perfil_por_profissional_do_consultorio_e_so_categorias_oficiais() -> None:
    assert set(PERFIS) == {v.id for v in VENDEDORES}
    for perfil in PERFIS.values():
        assert set(perfil.por_categoria) <= set(CATEGORIAS)
        for teto in perfil.tetos:
            assert teto.categorias <= set(CATEGORIAS)


def test_certeza_base_sobe_com_o_preco() -> None:
    bases = [PERFIS[v.id].base for v in VENDEDORES]
    custos = [v.custo_diamantes for v in VENDEDORES]
    assert custos == sorted(custos)
    assert bases == sorted(bases) and len(set(bases)) == len(bases)


@pytest.mark.parametrize(("patamar", "faixa"), [(1, 0), (5, 0), (6, 1), (10, 1), (11, 2), (15, 2)])
def test_faixas_do_patamar(patamar, faixa) -> None:
    assert faixa_do_patamar(patamar) == faixa


@pytest.mark.parametrize("profissional", list(PERFIS))
def test_sempre_entre_os_limites_nunca_100_nunca_pior_que_adivinhar(profissional) -> None:
    for categoria in CATEGORIAS:
        for patamar in PATAMARES:
            for pergunta_id in _ids(10):
                c = calcular_certeza(profissional, categoria, patamar, pergunta_id)
                assert CERTEZA_MINIMA <= c <= CERTEZA_MAXIMA < 1
                assert c > 0.25
                assert c == round(c, 2)


def test_sem_pergunta_em_curso_devolve_a_base() -> None:
    for profissional, perfil in PERFIS.items():
        assert calcular_certeza(profissional, None, None, None) == perfil.base


# --- Estudante João: fundamentos ----------------------------------------------


def test_joao_bonus_alto_nos_fundamentos_e_em_anatomia() -> None:
    for patamar in FUNDAMENTOS:
        assert _sem_variacao(JOAO, "anatomia_ocular", patamar) >= 0.80
        for categoria in CATEGORIAS:
            assert _sem_variacao(JOAO, categoria, patamar) > _sem_variacao(JOAO, categoria, patamar + 10)
    # Anatomia é a sua melhor categoria, em qualquer faixa.
    for patamar in PATAMARES:
        assert max(CATEGORIAS, key=lambda c: _sem_variacao(JOAO, c, patamar)) == "anatomia_ocular"


def test_joao_penalizacao_severa_no_fim_de_jogo_e_em_doencas() -> None:
    for patamar in FIM_DE_JOGO:
        for pergunta_id in _ids():
            assert calcular_certeza(JOAO, "doencas_estrabismo", patamar, pergunta_id) == CERTEZA_MINIMA
        # Mesmo a sua melhor categoria cai muito no fim de jogo.
        assert _sem_variacao(JOAO, "anatomia_ocular", patamar) <= 0.55
    for patamar in PATAMARES:
        assert min(CATEGORIAS, key=lambda c: _sem_variacao(JOAO, c, patamar)) == "doencas_estrabismo"


# --- Enfermeira Marta: prática -------------------------------------------------


def test_marta_bonus_constante_em_prevencao() -> None:
    for patamar in PATAMARES:
        prevencao = _sem_variacao(MARTA, "prevencao_cuidados", patamar)
        assert all(prevencao > _sem_variacao(MARTA, c, patamar) for c in CATEGORIAS if c != "prevencao_cuidados")
    # O bónus é o mesmo em todas as faixas (só a faixa muda o nível).
    bonus = {round(_sem_variacao(MARTA, "prevencao_cuidados", p) - _sem_variacao(MARTA, "anatomia_ocular", p), 6) for p in PATAMARES}
    assert len(bonus) == 1 and bonus.pop() > 0


def test_marta_media_boa_ate_ao_10_e_cai_no_fim_de_jogo() -> None:
    for categoria in CATEGORIAS:
        ate_10 = {_sem_variacao(MARTA, categoria, p) for p in [*FUNDAMENTOS, *INTERMEDIO]}
        assert len(ate_10) == 1  # estável nos patamares 1-10
        if categoria != "ciencia_ocular":  # ciência pura: o seu ponto fraco
            assert ate_10.pop() >= 0.70
        assert all(_sem_variacao(MARTA, categoria, p) < _sem_variacao(MARTA, categoria, 10) - 0.1 for p in FIM_DE_JOGO)


# --- Dr. Paulo (Optometrista): ciência ------------------------------------------


def test_paulo_muito_forte_em_ciencia_e_nos_patamares_intermedios_e_altos() -> None:
    for patamar in [*INTERMEDIO, *FIM_DE_JOGO]:
        for pergunta_id in _ids():
            assert calcular_certeza(PAULO, "ciencia_ocular", patamar, pergunta_id) >= 0.93
    for categoria in CATEGORIAS:
        assert _sem_variacao(PAULO, categoria, 8) > _sem_variacao(PAULO, categoria, 3)
        assert _sem_variacao(PAULO, categoria, 13) > _sem_variacao(PAULO, categoria, 3)


def test_paulo_ligeira_penalizacao_em_curiosidades() -> None:
    for patamar in PATAMARES:
        curiosidades = _sem_variacao(PAULO, "curiosidades_visuais", patamar)
        assert curiosidades == min(_sem_variacao(PAULO, c, patamar) for c in CATEGORIAS)
        # Ligeira: continua acima da base do estudante e da enfermeira.
        assert curiosidades > PERFIS[MARTA].base


# --- Dra. Helena (Oftalmologista): a especialista de topo ----------------------


def test_helena_maximo_no_fim_de_jogo_em_doencas() -> None:
    tabela = {(c, p): _sem_variacao(HELENA, c, p) for c in CATEGORIAS for p in PATAMARES}
    maximo = max(tabela.values())
    assert all(c == "doencas_estrabismo" and p in FIM_DE_JOGO for (c, p), v in tabela.items() if v == maximo)
    for pergunta_id in _ids():
        assert calcular_certeza(HELENA, "doencas_estrabismo", 13, pergunta_id) >= 0.94
    # No fim de jogo é a mais fiável dos quatro, em todas as categorias.
    for categoria in CATEGORIAS:
        assert _sem_variacao(HELENA, categoria, 13) >= max(
            _sem_variacao(p, categoria, 13) for p in (JOAO, MARTA)
        )


def test_helena_nao_e_infalivel_no_basico_de_estilo_de_vida() -> None:
    for patamar in (1, 2, 3):
        for pergunta_id in _ids(200):
            assert calcular_certeza(HELENA, "estilo_vida_visao", patamar, pergunta_id) <= 0.80
    # O tecto só vale para 1-3: no patamar 4 já pode passar dos 80%.
    assert max(calcular_certeza(HELENA, "estilo_vida_visao", 4, i) for i in _ids(200)) > 0.80


# --- Variação determinista por pergunta ------------------------------------------


def test_variacao_e_determinista_e_limitada() -> None:
    for profissional in PERFIS:
        for pergunta_id in _ids(200):
            v = variacao_deterministica(profissional, pergunta_id)
            assert v == variacao_deterministica(profissional, pergunta_id)
            assert -VARIACAO_MAXIMA_PP / 100 <= v <= VARIACAO_MAXIMA_PP / 100
            assert v == round(v, 2)


def test_variacao_usa_os_valores_todos_e_centrada_em_zero() -> None:
    valores = [variacao_deterministica(JOAO, i) for i in _ids(2000)]
    assert {round(v * 100) for v in valores} == set(range(-VARIACAO_MAXIMA_PP, VARIACAO_MAXIMA_PP + 1))
    assert abs(mean(valores)) < 0.005


def test_mesma_categoria_e_patamar_perguntas_diferentes_percentagens_diferentes() -> None:
    # Ex. pedido: uma dá 82%, outra 87% -- não todas a mesma percentagem redonda.
    for profissional in PERFIS:
        valores = {calcular_certeza(profissional, "anatomia_ocular", 7, i) for i in _ids(40)}
        assert len(valores) >= 5, profissional


def test_a_variacao_e_por_profissional() -> None:
    # A mesma pergunta não desloca os quatro na mesma direcção.
    desvios = {tuple(variacao_deterministica(p, i) for p in PERFIS) for i in _ids(40)}
    assert any(len(set(d)) > 1 for d in desvios)


# --- Sobre as 225 perguntas reais da reserva -------------------------------------


def _certezas_na_reserva(profissional: str) -> list[float]:
    """Cada pergunta nos cinco patamares do seu nível (1 -> 1-5, 2 -> 6-10,
    3 -> 11-15), com o texto como id."""
    return [
        calcular_certeza(profissional, q.categoria, patamar, q.texto_pergunta)
        for q in PERGUNTAS
        for patamar in range((q.nivel_dificuldade - 1) * 5 + 1, q.nivel_dificuldade * 5 + 1)
    ]


def test_na_reserva_quem_custa_mais_acerta_mais_em_media() -> None:
    medias = [mean(_certezas_na_reserva(v.id)) for v in VENDEDORES]
    assert medias == sorted(medias)
    assert medias[0] < 0.55 and medias[-1] > 0.85


def test_na_reserva_ha_variedade_de_percentagens() -> None:
    for v in VENDEDORES:
        assert len(set(_certezas_na_reserva(v.id))) >= 15, v.id


def test_na_reserva_o_estudante_vale_a_pena_nas_perguntas_faceis_de_anatomia() -> None:
    faceis_anatomia = [q for q in PERGUNTAS if q.nivel_dificuldade == 1 and q.categoria == "anatomia_ocular"]
    assert faceis_anatomia
    assert mean(calcular_certeza(JOAO, q.categoria, 3, q.texto_pergunta) for q in faceis_anatomia) >= 0.78
