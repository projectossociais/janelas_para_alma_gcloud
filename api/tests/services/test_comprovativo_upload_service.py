"""Testes do `ComprovativoUploadService` — duas garantias:

1. A mentira possível: apresentar, ao criar a doação/pedido, uma chave que
   não é um comprovativo (ver `validar_chave_de_comprovativo`, usado por
   `doacao_service.py`, `premium_service.py` e `loja_jogo_service.py`).
2. Nenhum comprovativo novo vai parar ao bucket público: sem o bucket
   privado configurado, recusa em vez de cair para o público (são
   comprovativos bancários, com o nome e a conta de quem pagou)."""

import pytest

from app.services.comprovativo_upload_service import (
    ArmazenamentoPrivadoIndisponivelError,
    ChaveDeComprovativoInvalidaError,
    ComprovativoUploadService,
    TipoDeFicheiroNaoPermitidoError,
    validar_chave_de_comprovativo,
)
from tests.services.test_upload_service import PresignerFalso


class TestPreparar:
    def test_gera_chave_no_prefixo_comprovativos_e_assina_o_url(self) -> None:
        presigner = PresignerFalso()
        servico = ComprovativoUploadService(presigner)

        preparado = servico.preparar("application/pdf")

        assert preparado.chave.startswith("comprovativos/")
        assert preparado.chave.endswith(".pdf")
        assert presigner.chamadas == [(preparado.chave, "application/pdf")]

    def test_nao_devolve_nenhum_url_publico(self) -> None:
        preparado = ComprovativoUploadService(PresignerFalso()).preparar("image/png")

        assert not hasattr(preparado, "url_publico")

    def test_aceita_imagens_alem_de_pdf(self) -> None:
        servico = ComprovativoUploadService(PresignerFalso())
        assert servico.preparar("image/png").chave.endswith(".png")

    def test_recusa_tipo_de_ficheiro_fora_da_lista(self) -> None:
        presigner = PresignerFalso()
        servico = ComprovativoUploadService(presigner)

        with pytest.raises(TipoDeFicheiroNaoPermitidoError):
            servico.preparar("application/zip")
        assert presigner.chamadas == []

    def test_sem_bucket_privado_recusa_em_vez_de_usar_o_publico(self) -> None:
        servico = ComprovativoUploadService(None)

        with pytest.raises(ArmazenamentoPrivadoIndisponivelError):
            servico.preparar("application/pdf")


class TestValidarChaveDeComprovativo:
    def test_devolve_a_propria_chave_quando_e_valida(self) -> None:
        assert validar_chave_de_comprovativo("comprovativos/abc.pdf") == "comprovativos/abc.pdf"

    def test_recusa_chave_fora_do_prefixo(self) -> None:
        with pytest.raises(ChaveDeComprovativoInvalidaError):
            validar_chave_de_comprovativo("avatares/outro/foto.png")

    def test_recusa_chave_vazia(self) -> None:
        with pytest.raises(ChaveDeComprovativoInvalidaError):
            validar_chave_de_comprovativo("")

    def test_recusa_chave_que_sobe_de_directorio(self) -> None:
        with pytest.raises(ChaveDeComprovativoInvalidaError):
            validar_chave_de_comprovativo("comprovativos/../avatares/x.png")
