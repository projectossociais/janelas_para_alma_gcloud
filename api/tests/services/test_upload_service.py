"""Testes do `UploadService` — as duas mentiras possíveis do utilizador:
o tipo do ficheiro e a dona da chave que manda confirmar.
"""

import pytest

from app.core.config import obter_settings
from app.services.upload_service import (
    ChaveDeAvatarInvalidaError,
    TipoDeFicheiroNaoPermitidoError,
    UploadService,
)

BASE_PUBLICA = "https://cdn.exemplo.test"


class PresignerFalso:
    def __init__(self) -> None:
        self.chamadas: list[tuple[str, str]] = []

    def url_de_upload(self, chave: str, content_type: str) -> str:
        self.chamadas.append((chave, content_type))
        return f"https://r2.exemplo.test/{chave}?assinatura=abc"


class AvatarRepositorioFalso:
    def __init__(self) -> None:
        self.gravado: dict[str, str | None] = {}

    def definir_avatar_url(self, utilizador_id: str, url: str | None) -> None:
        self.gravado[utilizador_id] = url


@pytest.fixture(autouse=True)
def _base_publica(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(obter_settings(), "r2_public_base_url", BASE_PUBLICA)


@pytest.fixture
def servico() -> tuple[UploadService, PresignerFalso, AvatarRepositorioFalso]:
    presigner = PresignerFalso()
    avatares = AvatarRepositorioFalso()
    return UploadService(presigner, avatares), presigner, avatares


class TestPrepararAvatar:
    def test_gera_chave_no_prefixo_do_utilizador_e_assina_o_url(self, servico) -> None:
        svc, presigner, _ = servico

        preparado = svc.preparar_avatar("user-1", "image/png")

        assert preparado.chave.startswith("avatares/user-1/")
        assert preparado.chave.endswith(".png")
        assert preparado.url_publico == f"{BASE_PUBLICA}/{preparado.chave}"
        assert presigner.chamadas == [(preparado.chave, "image/png")]

    def test_jpeg_vira_extensao_jpg(self, servico) -> None:
        svc, _, _ = servico
        assert svc.preparar_avatar("user-1", "image/jpeg").chave.endswith(".jpg")

    def test_recusa_tipo_de_ficheiro_fora_da_lista(self, servico) -> None:
        svc, presigner, _ = servico

        with pytest.raises(TipoDeFicheiroNaoPermitidoError):
            svc.preparar_avatar("user-1", "application/pdf")
        assert presigner.chamadas == []  # nunca chegou a assinar nada

    def test_recusa_image_jpg_que_nao_e_um_media_type_valido(self, servico) -> None:
        svc, _, _ = servico
        with pytest.raises(TipoDeFicheiroNaoPermitidoError):
            svc.preparar_avatar("user-1", "image/jpg")


class TestConfirmarAvatar:
    def test_grava_o_url_publico_quando_a_chave_e_do_proprio(self, servico) -> None:
        svc, _, avatares = servico
        chave = "avatares/user-1/abcd.png"

        url = svc.confirmar_avatar("user-1", chave)

        assert url == f"{BASE_PUBLICA}/{chave}"
        assert avatares.gravado == {"user-1": url}

    def test_recusa_confirmar_a_chave_de_outro_utilizador(self, servico) -> None:
        svc, _, avatares = servico

        with pytest.raises(ChaveDeAvatarInvalidaError):
            svc.confirmar_avatar("user-1", "avatares/user-2/abcd.png")
        assert avatares.gravado == {}  # nada gravado no caminho do erro

    def test_recusa_chave_sem_o_prefixo_avatares(self, servico) -> None:
        svc, _, _ = servico
        with pytest.raises(ChaveDeAvatarInvalidaError):
            svc.confirmar_avatar("user-1", "../etc/passwd")
