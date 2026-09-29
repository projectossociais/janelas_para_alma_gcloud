from datetime import UTC, date, datetime, timedelta

import pytest

from app.services.bonus_assiduidade_service import (
    DIAMANTES_POR_MARCO,
    MOEDAS_POR_DIA,
    BonusAssiduidadeService,
    conta_para_bonus,
)


class RepositorioBonusFalso:
    """Mesmo contrato do SQLAlchemy: um crédito por (utilizador, dia)."""

    def __init__(self, dias: set[date] | None = None) -> None:
        self.dias: set[date] = set(dias or ())
        self.creditos: list[tuple[str, date, int, int]] = []

    def dias_seguidos_ate(self, utilizador_id: str, dia: date) -> int:
        n = 0
        while dia - timedelta(days=n) in self.dias:
            n += 1
        return n

    def creditar_dia(self, utilizador_id: str, dia: date, moedas: int, diamantes: int) -> bool:
        if dia in self.dias:
            return False
        self.dias.add(dia)
        self.creditos.append((utilizador_id, dia, moedas, diamantes))
        return True


class RepositorioBonusQueFalha(RepositorioBonusFalso):
    def creditar_dia(self, utilizador_id, dia, moedas, diamantes) -> bool:
        raise RuntimeError("base de dados em baixo")


# 10:00 em Luanda, 29/09
AGORA = datetime(2026, 9, 29, 9, 0, tzinfo=UTC)
HOJE = date(2026, 9, 29)
TREINO_OK = {"exercicio_id": "ambliopia", "versao": 2, "segundos_activos": 360, "sinais": {"baixa_atencao": False}}


def _servico(repo: RepositorioBonusFalso, agora: datetime = AGORA) -> BonusAssiduidadeService:
    return BonusAssiduidadeService(repo, relogio=lambda: agora)


def test_primeiro_treino_do_dia_da_100_moedas() -> None:
    repo = RepositorioBonusFalso()
    b = _servico(repo).registar_treino("u1", **TREINO_OK)
    assert (b.moedas, b.diamantes, b.dias_seguidos) == (MOEDAS_POR_DIA, 0, 1)
    assert repo.creditos == [("u1", HOJE, 100, 0)]


def test_segundo_treino_no_mesmo_dia_nao_da_nada() -> None:
    repo = RepositorioBonusFalso()
    s = _servico(repo)
    s.registar_treino("u1", **TREINO_OK)
    assert s.registar_treino("u1", **TREINO_OK) is None
    assert len(repo.creditos) == 1


def test_setimo_dia_seguido_da_os_diamantes_do_marco() -> None:
    repo = RepositorioBonusFalso({HOJE - timedelta(days=i) for i in range(1, 7)})  # 6 dias antes de hoje
    b = _servico(repo).registar_treino("u1", **TREINO_OK)
    assert (b.dias_seguidos, b.diamantes) == (7, DIAMANTES_POR_MARCO)


def test_dia_falhado_recomeca_a_sequencia() -> None:
    repo = RepositorioBonusFalso({HOJE - timedelta(days=i) for i in range(2, 8)})  # falhou ontem
    b = _servico(repo).registar_treino("u1", **TREINO_OK)
    assert (b.dias_seguidos, b.diamantes) == (1, 0)


def test_o_dia_e_o_de_luanda_nao_o_utc() -> None:
    # 23:30 UTC de 29/09 já é 00:30 de 30/09 em Luanda
    repo = RepositorioBonusFalso({HOJE})
    b = _servico(repo, datetime(2026, 9, 29, 23, 30, tzinfo=UTC)).registar_treino("u1", **TREINO_OK)
    assert b is not None and b.dias_seguidos == 2
    assert repo.creditos[-1][1] == date(2026, 9, 30)


@pytest.mark.parametrize(
    "mudanca",
    [
        {"exercicio_id": "figure8"},  # teste de triagem, não treino
        {"versao": 1},  # sessão antiga
        {"segundos_activos": 59},  # menos de 1 minuto activo
        {"segundos_activos": None},
        {"sinais": {"baixa_atencao": True}},  # falhou os estímulos de controlo
    ],
)
def test_so_um_treino_real_conta(mudanca: dict) -> None:
    repo = RepositorioBonusFalso()
    assert _servico(repo).registar_treino("u1", **{**TREINO_OK, **mudanca}) is None
    assert repo.creditos == []


def test_conta_para_bonus_aceita_os_4_treinos_sem_sinais() -> None:
    for t in ("ambliopia", "sacadas-convergencia", "convergence", "flexibilidade-acomodativa"):
        assert conta_para_bonus(t, 2, 120, None)
