"""Unidades aceites no `limiar` de uma sessão de exercício."""

import pytest
from pydantic import ValidationError

from app.schemas.sessao_exercicio import SessaoExercicioCriar

BASE = {"exercicio_id": "convergence", "duracao_segundos": 60}


@pytest.mark.parametrize(
    "unidade", ["logmar", "log_cs", "arcsec", "segundos", "dioptrias_prismaticas", "razao_contraste", "graus", "cm", "mm"]
)
def test_unidades_aceites(unidade: str) -> None:
    sessao = SessaoExercicioCriar(**BASE, limiar=18, unidade=unidade)
    assert sessao.unidade == unidade


def test_pontes_de_fusao_gravam_em_dioptrias_prismaticas() -> None:
    sessao = SessaoExercicioCriar(
        **BASE,
        olho="ambos",
        limiar=18,
        unidade="dioptrias_prismaticas",
        sinais={"pontes": {"convergencia": {"rampas": 2, "rotura": 18, "recuperacao": 12}}},
    )
    assert sessao.limiar == 18


def test_unidade_desconhecida_e_recusada() -> None:
    with pytest.raises(ValidationError):
        SessaoExercicioCriar(**BASE, limiar=18, unidade="prismas")
