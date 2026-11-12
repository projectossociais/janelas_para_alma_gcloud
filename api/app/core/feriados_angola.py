"""Feriados nacionais de Angola, para não oferecer consultas em dias sem
expediente.

Lista da Lei n.º 10/11, alterada pela Lei n.º 11/18 (em vigor desde
2018-09-10; o 23 de Março conta desde 2019). A mesma lei cria a "ponte": um
feriado a uma terça suspende o trabalho na segunda anterior, e a uma quinta
na sexta seguinte. Conferido com a biblioteca `python-holidays` (AO) para
2019–2040.

Tolerâncias de ponto decretadas caso a caso (ex.: 24 e 31 de Dezembro) não
são lei e não entram aqui -- a clínica bloqueia-as no portal se fechar.
"""

from datetime import date, timedelta
from functools import cache

_FIXOS = (
    (1, 1, "Dia do Ano Novo"),
    (2, 4, "Dia do Início da Luta Armada de Libertação Nacional"),
    (3, 8, "Dia Internacional da Mulher"),
    (3, 23, "Dia da Libertação da África Austral"),
    (4, 4, "Dia da Paz e Reconciliação Nacional"),
    (5, 1, "Dia Internacional do Trabalhador"),
    (9, 17, "Dia do Fundador da Nação e do Herói Nacional"),
    (11, 2, "Dia dos Finados"),
    (11, 11, "Dia da Independência Nacional"),
    (12, 25, "Dia de Natal e da Família"),
)

_TERCA, _QUINTA = 1, 3


def _domingo_de_pascoa(ano: int) -> date:
    """Algoritmo gregoriano anónimo (Meeus/Jones/Butcher)."""
    a, b, c = ano % 19, ano // 100, ano % 100
    d, e = b // 4, b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = c // 4, c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    mes = (h + l - 7 * m + 114) // 31
    dia = (h + l - 7 * m + 114) % 31 + 1
    return date(ano, mes, dia)


def _feriados_do_ano(ano: int) -> dict[date, str]:
    feriados = {date(ano, mes, dia): nome for mes, dia, nome in _FIXOS}
    pascoa = _domingo_de_pascoa(ano)
    feriados[pascoa - timedelta(days=47)] = "Dia do Carnaval"
    feriados[pascoa - timedelta(days=2)] = "Sexta-Feira Santa"
    return feriados


@cache
def feriados_angola(ano: int) -> dict[date, str]:
    """Feriados e pontes que caem neste ano civil (inclui a ponte de 31/12
    quando o Ano Novo seguinte é a uma terça)."""
    resultado: dict[date, str] = {}
    for origem in (_feriados_do_ano(ano - 1), _feriados_do_ano(ano), _feriados_do_ano(ano + 1)):
        for dia, nome in origem.items():
            if dia.year == ano:
                resultado.setdefault(dia, nome)
            if dia.weekday() == _TERCA:
                ponte = dia - timedelta(days=1)
            elif dia.weekday() == _QUINTA:
                ponte = dia + timedelta(days=1)
            else:
                continue
            if ponte.year == ano:
                resultado.setdefault(ponte, f"{nome} (ponte)")
    return resultado


def e_feriado(dia: date) -> bool:
    return dia in feriados_angola(dia.year)
