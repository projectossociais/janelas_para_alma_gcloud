"""`GET /impacto/numeros`: público, só contagens, com cache curta."""

from fastapi.testclient import TestClient

from app.main import app
from app.repositories.impacto_repository import NumerosImpactoRegisto
from app.routers.impacto import obter_impacto_repository


class RepositorioImpactoFalso:
    def obter_numeros(self) -> NumerosImpactoRegisto:
        return NumerosImpactoRegisto(rastreios=120, sessoes_treino=845, encaminhamentos=17)


def test_devolve_os_numeros_sem_sessao_e_com_cache() -> None:
    app.dependency_overrides[obter_impacto_repository] = lambda: RepositorioImpactoFalso()
    try:
        with TestClient(app) as c:
            resposta = c.get("/impacto/numeros")
    finally:
        app.dependency_overrides.clear()

    assert resposta.status_code == 200
    assert resposta.json() == {"rastreios": 120, "sessoes_treino": 845, "encaminhamentos": 17}
    assert "max-age=300" in resposta.headers["cache-control"]
