"""Testes do `BannerHomepageUploadService` — a mentira possível aqui é
confirmar uma chave que não pertence ao banner (mesma forma do avatar/
publicação, ver `test_upload_service.py`)."""

import pytest

from app.core.config import obter_settings
from app.services.banner_homepage_upload_service import (
    BannerHomepageUploadService,
    ChaveDeImagemInvalidaError,
    TipoDeFicheiroNaoPermitidoError,
)
from tests.services.test_upload_service import PresignerFalso

BASE_PUBLICA = "https://cdn.exemplo.test"


class BannerHomepageRepositorioFalso:
    def __init__(self) -> None:
        self.imagens: dict[str, str] = {}

    def definir_imagem_url(self, banner_id: str, url: str) -> None:
        self.imagens[banner_id] = url


@pytest.fixture(autouse=True)
def _base_publica(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(obter_settings(), "r2_public_base_url", BASE_PUBLICA)


@pytest.fixture
def servico() -> tuple[BannerHomepageUploadService, PresignerFalso, BannerHomepageRepositorioFalso]:
    presigner = PresignerFalso()
    repo = BannerHomepageRepositorioFalso()
    return BannerHomepageUploadService(presigner, repo), presigner, repo


class TestPreparar:
    def test_gera_chave_no_prefixo_do_banner(self, servico) -> None:
        svc, presigner, _ = servico
        preparado = svc.preparar("banner-1", "image/webp")
        assert preparado.chave.startswith("banners-homepage/banner-1/")
        assert preparado.chave.endswith(".webp")
        assert preparado.url_publico == f"{BASE_PUBLICA}/{preparado.chave}"
        assert presigner.chamadas == [(preparado.chave, "image/webp")]

    def test_recusa_tipo_de_ficheiro_fora_da_lista(self, servico) -> None:
        svc, presigner, _ = servico
        with pytest.raises(TipoDeFicheiroNaoPermitidoError):
            svc.preparar("banner-1", "application/pdf")
        assert presigner.chamadas == []


class TestConfirmar:
    def test_grava_a_imagem_quando_a_chave_e_do_banner(self, servico) -> None:
        svc, _, repo = servico
        chave = "banners-homepage/banner-1/abc.png"
        url = svc.confirmar("banner-1", chave)
        assert url == f"{BASE_PUBLICA}/{chave}"
        assert repo.imagens == {"banner-1": url}

    def test_recusa_chave_de_outro_banner(self, servico) -> None:
        svc, _, repo = servico
        with pytest.raises(ChaveDeImagemInvalidaError):
            svc.confirmar("banner-1", "banners-homepage/banner-2/abc.png")
        assert repo.imagens == {}

    def test_recusa_chave_fora_do_prefixo_banners_homepage(self, servico) -> None:
        svc, _, repo = servico
        with pytest.raises(ChaveDeImagemInvalidaError):
            svc.confirmar("banner-1", "avatares/banner-1/abc.png")
        assert repo.imagens == {}
