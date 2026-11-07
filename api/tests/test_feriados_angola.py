"""Feriados nacionais de Angola (Lei n.º 10/11 alterada pela Lei n.º 11/18)."""

from datetime import date

from app.core.feriados_angola import _domingo_de_pascoa, e_feriado, feriados_angola


def test_calendario_oficial_de_2026() -> None:
    # Os 12 feriados de 2026 (Ministério do Turismo, via Ver Angola) e as
    # duas pontes que caem em dias úteis: Carnaval à terça e 17/9 à quinta.
    assert set(feriados_angola(2026)) == {
        date(2026, 1, 1),
        date(2026, 1, 2),  # ponte do Ano Novo (quinta)
        date(2026, 2, 4),
        date(2026, 2, 16),  # ponte do Carnaval
        date(2026, 2, 17),  # Carnaval
        date(2026, 3, 8),
        date(2026, 3, 23),
        date(2026, 4, 3),  # Sexta-feira Santa
        date(2026, 4, 4),
        date(2026, 5, 1),
        date(2026, 9, 17),
        date(2026, 9, 18),  # ponte do Dia do Herói Nacional
        date(2026, 11, 2),
        date(2026, 11, 11),
        date(2026, 12, 25),
    }


def test_ponte_de_terca_e_na_segunda_anterior_e_de_quinta_na_sexta_seguinte() -> None:
    assert e_feriado(date(2027, 2, 4))  # quinta
    assert e_feriado(date(2027, 2, 5))  # sexta, ponte
    assert e_feriado(date(2027, 2, 9))  # Carnaval, terça
    assert e_feriado(date(2027, 2, 8))  # segunda, ponte


def test_ponte_do_ano_novo_pode_cair_no_ano_anterior() -> None:
    # 1/1/2030 é uma terça: a ponte é a segunda 31/12/2029.
    assert feriados_angola(2029)[date(2029, 12, 31)] == "Dia do Ano Novo (ponte)"


def test_dia_util_normal_nao_e_feriado() -> None:
    assert not e_feriado(date(2026, 11, 12))
    assert not e_feriado(date(2026, 12, 24))  # tolerância de ponto não é lei


def test_pascoa() -> None:
    assert _domingo_de_pascoa(2026) == date(2026, 4, 5)
    assert _domingo_de_pascoa(2027) == date(2027, 3, 28)
    assert _domingo_de_pascoa(2038) == date(2038, 4, 25)
