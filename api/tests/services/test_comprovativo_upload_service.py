"""Testes do `ComprovativoUploadService` — a mentira possível aqui é
apresentar, ao criar a doação/pedido, uma chave que não é um comprovativo
(ver `referencia_do_comprovativo`, usado por `doacao_service.py`,
`premium_service.py` e `loja_jogo_service.py`) -- e, desde 2026-10-14, que o
comprovativo nunca fica no bucket público quando há bucket privado."""

import pytest

from app.core.config import obter_settings
from app.services.comprovativo_upload_service import (
    ChaveDeComprovativoInvalidaError,
    ComprovativoUploadService,
    TipoDeFicheiroNaoPermitidoError,
    referencia_do_comprovativo,
    url_de_leitura_do_comprovativo,
)
from tests.services.test_upload_service import PresignerFalso

BASE_PUBLICA = "https://cdn.exemplo.test"


@pytest.fixture(autouse=True)
def _base_publica(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(obter_settings(), "r2_public_base_url", BASE_PUBLICA)
    monkeypatch.setattr(obter_settings(), "r2_bucket_comprovativos", "")


@pytest.fixture
def bucket_privado(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(obter_settings(), "r2_bucket_comprovativos", "jpa-comprovativos")


class LeitorFalso:
    def url_de_leitura(self, chave: str) -> str:
        return f"https://r2.privado.test/{chave}?assinado=1"


class TestPreparar:
    def test_gera_chave_no_prefixo_comprovativos_e_assina_o_url(self) -> None:
        presigner = PresignerFalso()
        servico = ComprovativoUploadService(presigner, privado=False)

        preparado = servico.preparar("application/pdf")

        assert preparado.chave.startswith("comprovativos/")
        assert preparado.chave.endswith(".pdf")
        assert preparado.url_publico == f"{BASE_PUBLICA}/{preparado.chave}"
        assert presigner.chamadas == [(preparado.chave, "application/pdf")]

    def test_aceita_imagens_alem_de_pdf(self) -> None:
        servico = ComprovativoUploadService(PresignerFalso())
        assert servico.preparar("image/png").chave.endswith(".png")

    def test_recusa_tipo_de_ficheiro_fora_da_lista(self) -> None:
        presigner = PresignerFalso()
        servico = ComprovativoUploadService(presigner)

        with pytest.raises(TipoDeFicheiroNaoPermitidoError):
            servico.preparar("application/zip")
        assert presigner.chamadas == []


    def test_com_bucket_privado_nao_ha_url_publico(self) -> None:
        preparado = ComprovativoUploadService(PresignerFalso(), privado=True).preparar("image/jpeg")
        assert preparado.url_publico is None
        assert preparado.chave.startswith("comprovativos/")


class TestReferenciaDoComprovativo:
    def test_sem_bucket_privado_mantem_o_url_publico_antigo(self) -> None:
        assert (
            referencia_do_comprovativo("comprovativos/abc.pdf")
            == f"{BASE_PUBLICA}/comprovativos/abc.pdf"
        )

    def test_com_bucket_privado_grava_so_a_chave(self, bucket_privado) -> None:
        assert referencia_do_comprovativo("comprovativos/abc.pdf") == "comprovativos/abc.pdf"

    @pytest.mark.parametrize("chave", ["avatares/outro/foto.png", "", "comprovativos/../avatares/x.png"])
    def test_recusa_chave_fora_do_prefixo(self, chave) -> None:
        with pytest.raises(ChaveDeComprovativoInvalidaError):
            referencia_do_comprovativo(chave)


class TestUrlDeLeituraDoComprovativo:
    def test_chave_privada_da_um_url_assinado(self) -> None:
        url = url_de_leitura_do_comprovativo("comprovativos/abc.pdf", LeitorFalso())
        assert url == "https://r2.privado.test/comprovativos/abc.pdf?assinado=1"

    def test_url_publico_antigo_continua_a_abrir(self) -> None:
        antigo = f"{BASE_PUBLICA}/comprovativos/antigo.png"
        assert url_de_leitura_do_comprovativo(antigo, LeitorFalso()) == antigo

    @pytest.mark.parametrize(
        "referencia",
        [
            "https://outro-site.test/comprovativos/x.pdf",
            f"{BASE_PUBLICA}/avatares/u/x.png",
            "avatares/u/x.png",
            "comprovativos-pagamento/u/x.pdf",
            "comprovativos/../videos-exercicios/x.mp4",
        ],
    )
    def test_recusa_tudo_o_que_nao_e_um_comprovativo(self, referencia) -> None:
        with pytest.raises(ChaveDeComprovativoInvalidaError):
            url_de_leitura_do_comprovativo(referencia, LeitorFalso())
