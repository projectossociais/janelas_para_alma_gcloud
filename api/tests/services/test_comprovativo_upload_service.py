"""Testes do `ComprovativoUploadService` — a mentira possível aqui é
apresentar, ao criar a doação/pedido, uma chave que não é um comprovativo
(ver `url_publico_do_comprovativo`, usado por `doacao_service.py` e
`premium_service.py`)."""

import pytest

from app.core.config import obter_settings
from app.services.comprovativo_upload_service import (
    ChaveDeComprovativoInvalidaError,
    ComprovativoUploadService,
    TipoDeFicheiroNaoPermitidoError,
    url_publico_do_comprovativo,
)
from tests.services.test_upload_service import PresignerFalso

BASE_PUBLICA = "https://cdn.exemplo.test"


@pytest.fixture(autouse=True)
def _base_publica(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(obter_settings(), "r2_public_base_url", BASE_PUBLICA)


class TestPreparar:
    def test_gera_chave_no_prefixo_comprovativos_e_assina_o_url(self) -> None:
        presigner = PresignerFalso()
        servico = ComprovativoUploadService(presigner)

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


class TestUrlPublicoDoComprovativo:
    def test_devolve_o_url_publico_para_uma_chave_valida(self) -> None:
        assert (
            url_publico_do_comprovativo("comprovativos/abc.pdf")
            == f"{BASE_PUBLICA}/comprovativos/abc.pdf"
        )

    def test_recusa_chave_fora_do_prefixo(self) -> None:
        with pytest.raises(ChaveDeComprovativoInvalidaError):
            url_publico_do_comprovativo("avatares/outro/foto.png")

    def test_recusa_chave_vazia(self) -> None:
        with pytest.raises(ChaveDeComprovativoInvalidaError):
            url_publico_do_comprovativo("")
