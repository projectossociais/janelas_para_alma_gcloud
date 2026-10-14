"""O percurso inteiro de uma captura de ecrã com o **Tesseract verdadeiro**
(`TesseractLeitorOcr`): desenhar o ecrã, gravar como PNG/JPEG, validar.
Salta se o Tesseract não estiver instalado (o CI instala-o -- ver
`.github/workflows/ci.yml`; a imagem de produção também, `api.Dockerfile`)."""

import shutil
from datetime import timedelta

import pytest

from app.core.ocr import TesseractLeitorOcr
from tests.services.pdf_falso import desenhar_ecra, desfocar, em_bytes, linhas_express
from tests.services.test_validacao_comprovativo_service import (
    AGORA,
    CONFIG,
    UTILIZADOR,
    RepositorioFalso,
    StorageFalso,
    _enviar,
    _servico_com,
)

pytestmark = pytest.mark.skipif(shutil.which("tesseract") is None, reason="Tesseract não instalado")


@pytest.fixture
def ambiente():
    repo, storage = RepositorioFalso(), StorageFalso()
    return _servico_com(CONFIG, repo, storage, ocr=TesseractLeitorOcr()), repo, storage


@pytest.mark.parametrize("escuro", [False, True], ids=["claro", "modo-escuro"])
def test_captura_do_express_lida_pelo_tesseract_aprova(ambiente, escuro) -> None:
    servico, repo, storage = ambiente
    png = em_bytes(desenhar_ecra(linhas_express(), escuro=escuro))

    reg = servico.validar(UTILIZADOR, _enviar(storage, png, nome="ecra.png"))

    assert reg.estado == "aprovado", reg.motivo
    assert reg.referencia_transacao == "MCX88776655"
    assert str(reg.montante_kz) == "15000.00"
    assert reg.destinatario_detectado == "923000111"
    assert reg.metadados_ficheiro["ocr_confianca"] >= 80
    assert repo.premium[UTILIZADOR] == AGORA + timedelta(days=30)


def test_a_mesma_captura_cortada_e_recomprimida_e_bloqueada(ambiente) -> None:
    servico, _, storage = ambiente
    img = desenhar_ecra(linhas_express())
    assert servico.validar(UTILIZADOR, _enviar(storage, em_bytes(img), nome="a")).estado == "aprovado"

    cortada = em_bytes(img.crop((2, 2, img.width - 2, img.height - 2)), "JPEG")
    reg = servico.validar(UTILIZADOR, _enviar(storage, cortada, nome="b"))
    assert (reg.estado, reg.motivo_codigo) == ("rejeitado", "transacao_ja_utilizada")


def test_captura_desfocada_vai_para_revisao(ambiente) -> None:
    servico, repo, storage = ambiente
    reg = servico.validar(UTILIZADOR, _enviar(storage, em_bytes(desfocar(desenhar_ecra(linhas_express())))))
    assert reg.estado == "revisao_manual"
    assert UTILIZADOR not in repo.premium
