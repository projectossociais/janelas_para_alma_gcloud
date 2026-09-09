from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.repositories.banners_repository import BannerRegisto
from app.routers.banners import obter_banners_repository


class RepositorioBannersFalso:
    def __init__(self, banner: BannerRegisto | None = None) -> None:
        self._banner = banner

    def obter_ativo(self) -> BannerRegisto | None:
        return self._banner


@pytest.fixture
def client_sem_banner():
    app.dependency_overrides[obter_banners_repository] = lambda: RepositorioBannersFalso(None)
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_sem_banner_ativo_devolve_null(client_sem_banner: TestClient) -> None:
    resposta = client_sem_banner.get("/banners/ativo")

    assert resposta.status_code == 200
    assert resposta.json() is None


def test_devolve_o_banner_ativo() -> None:
    banner = BannerRegisto(
        id="banner-1", titulo="Aviso", mensagem="Estamos em manutenção", link=None, created_at=datetime.now(UTC)
    )
    app.dependency_overrides[obter_banners_repository] = lambda: RepositorioBannersFalso(banner)
    try:
        with TestClient(app) as c:
            resposta = c.get("/banners/ativo")
    finally:
        app.dependency_overrides.clear()

    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["titulo"] == "Aviso"
    assert corpo["mensagem"] == "Estamos em manutenção"
