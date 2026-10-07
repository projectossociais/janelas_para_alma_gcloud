from datetime import UTC, datetime

from app.repositories.screening_repository import ScreeningRegisto
from app.services.classificacao_rastreio_service import MedicoesRastreio
from app.services.rastreio_completo_service import RastreioCompletoService


class GravadorFalso:
    def __init__(self) -> None:
        self.gravadas: list[dict] = []
        self.a_falhar = False

    def criar(self, **kw) -> ScreeningRegisto:
        if self.a_falhar:
            raise RuntimeError("falha simulada na gravação")
        self.gravadas.append(kw)
        return ScreeningRegisto(
            id=f"s-{len(self.gravadas)}", criado_em=datetime.now(UTC), encaminhado=False, **kw
        )


def medicoes(h: float = 1.0, v: float = 0.5, **kw) -> MedicoesRastreio:
    base = {
        "horizontal_delta": h,
        "vertical_delta": v,
        "dispersao_delta": 0.8,
        "fotografias_validas": 4,
        "fotografias_total": 5,
        "falha": None,
        "versao_motor": "motor-teste",
    }
    base.update(kw)
    return MedicoesRastreio(**base)  # type: ignore[arg-type]


def test_convidado_recebe_o_resultado_e_nada_se_grava() -> None:
    g = GravadorFalso()
    r = RastreioCompletoService(g).classificar_e_registar(medicoes(h=9.0), user_id=None)
    assert r.classificacao.conclusao == "encaminhar"
    assert r.screening_id is None
    assert g.gravadas == []


def test_com_sessao_encaminhar_grava_como_requer_avaliacao() -> None:
    g = GravadorFalso()
    r = RastreioCompletoService(g).classificar_e_registar(medicoes(h=9.0), user_id="u1")
    assert r.screening_id == "s-1"
    gravada = g.gravadas[0]
    assert gravada["user_id"] == "u1"
    assert gravada["diagnostico"] == "requer_avaliacao"
    assert gravada["requer_avaliacao_humana"] is True
    assert gravada["assimetria_horizontal"] == 9.0
    assert gravada["medicoes"]["unidade"] == "dioptrias_prismaticas"
    assert gravada["versao_analise"].startswith("motor-teste|")


def test_com_sessao_sem_sinais_grava_como_normal() -> None:
    g = GravadorFalso()
    r = RastreioCompletoService(g).classificar_e_registar(medicoes(h=1.0), user_id="u1")
    assert r.classificacao.conclusao == "sem_sinais"
    assert g.gravadas[0]["diagnostico"] == "normal"
    assert g.gravadas[0]["requer_avaliacao_humana"] is False


def test_nao_mediu_nunca_se_grava_nem_como_normal() -> None:
    g = GravadorFalso()
    svc = RastreioCompletoService(g)
    for m in (
        medicoes(fotografias_validas=1),
        medicoes(falha="sem-reflexo"),
        medicoes(dispersao_delta=9.0),
    ):
        r = svc.classificar_e_registar(m, user_id="u1")
        assert r.classificacao.conclusao == "nao_mediu"
        assert r.screening_id is None
    assert g.gravadas == []


def test_falha_na_gravacao_nao_e_engolida() -> None:
    """CLAUDE.md §6: nunca mostrar sucesso antes de verificar o erro. A excepção
    sobe; quem chama decide (o router devolve erro, não um id inventado)."""
    g = GravadorFalso()
    g.a_falhar = True
    try:
        RastreioCompletoService(g).classificar_e_registar(medicoes(), user_id="u1")
    except RuntimeError:
        return
    raise AssertionError("a falha de gravação foi engolida")
