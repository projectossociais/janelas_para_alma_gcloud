"""Testes do `PublicacaoMidiaService` — a mentira possível aqui é confirmar
uma chave que não pertence à publicação (mesma forma do avatar, ver
`test_upload_service.py`)."""

import pytest

from app.core.config import obter_settings
from app.repositories.publicacoes_repository import MidiaRegisto
from app.services.publicacao_midia_service import (
    ChaveDeMidiaInvalidaError,
    PublicacaoMidiaService,
    TipoDeFicheiroNaoPermitidoError,
)
from tests.services.test_upload_service import PresignerFalso

BASE_PUBLICA = "https://cdn.exemplo.test"


class PublicacoesMidiaRepositorioFalso:
    def __init__(self) -> None:
        self.capas: dict[str, str] = {}
        self.midias: list[tuple[str, str]] = []
        self.removidas: list[str] = []

    def definir_capa(self, publicacao_id: str, url: str) -> None:
        self.capas[publicacao_id] = url

    def adicionar_midia(self, publicacao_id: str, url: str) -> MidiaRegisto:
        self.midias.append((publicacao_id, url))
        return MidiaRegisto(id="midia-1", publicacao_id=publicacao_id, url=url, ordem=1)

    def remover_midia(self, midia_id: str) -> None:
        self.removidas.append(midia_id)


@pytest.fixture(autouse=True)
def _base_publica(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(obter_settings(), "r2_public_base_url", BASE_PUBLICA)


@pytest.fixture
def servico() -> tuple[PublicacaoMidiaService, PresignerFalso, PublicacoesMidiaRepositorioFalso]:
    presigner = PresignerFalso()
    repo = PublicacoesMidiaRepositorioFalso()
    return PublicacaoMidiaService(presigner, repo), presigner, repo


class TestPreparar:
    def test_gera_chave_no_prefixo_da_publicacao(self, servico) -> None:
        svc, presigner, _ = servico
        preparado = svc.preparar("pub-1", "image/webp")
        assert preparado.chave.startswith("publicacoes/pub-1/")
        assert preparado.chave.endswith(".webp")
        assert preparado.url_publico == f"{BASE_PUBLICA}/{preparado.chave}"
        assert presigner.chamadas == [(preparado.chave, "image/webp")]

    def test_recusa_tipo_de_ficheiro_fora_da_lista(self, servico) -> None:
        svc, presigner, _ = servico
        with pytest.raises(TipoDeFicheiroNaoPermitidoError):
            svc.preparar("pub-1", "application/pdf")
        assert presigner.chamadas == []


class TestConfirmarCapa:
    def test_grava_a_capa_quando_a_chave_e_da_publicacao(self, servico) -> None:
        svc, _, repo = servico
        chave = "publicacoes/pub-1/abc.png"
        url = svc.confirmar_capa("pub-1", chave)
        assert url == f"{BASE_PUBLICA}/{chave}"
        assert repo.capas == {"pub-1": url}

    def test_recusa_chave_de_outra_publicacao(self, servico) -> None:
        svc, _, repo = servico
        with pytest.raises(ChaveDeMidiaInvalidaError):
            svc.confirmar_capa("pub-1", "publicacoes/pub-2/abc.png")
        assert repo.capas == {}


class TestConfirmarMidia:
    def test_adiciona_midia_a_galeria_quando_a_chave_e_da_publicacao(self, servico) -> None:
        svc, _, repo = servico
        chave = "publicacoes/pub-1/foto.jpg"
        registo = svc.confirmar_midia("pub-1", chave)
        assert registo.url == f"{BASE_PUBLICA}/{chave}"
        assert repo.midias == [("pub-1", registo.url)]

    def test_recusa_chave_de_outra_publicacao(self, servico) -> None:
        svc, _, repo = servico
        with pytest.raises(ChaveDeMidiaInvalidaError):
            svc.confirmar_midia("pub-1", "publicacoes/pub-2/foto.jpg")
        assert repo.midias == []

    def test_recusa_chave_fora_do_prefixo_publicacoes(self, servico) -> None:
        svc, _, repo = servico
        with pytest.raises(ChaveDeMidiaInvalidaError):
            svc.confirmar_midia("pub-1", "avatares/pub-1/foto.jpg")
        assert repo.midias == []


class TestRemoverMidia:
    def test_remove_pelo_id(self, servico) -> None:
        svc, _, repo = servico
        svc.remover_midia("midia-1")
        assert repo.removidas == ["midia-1"]
