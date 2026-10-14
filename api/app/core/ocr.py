"""OCR (texto de uma imagem) para as capturas de ecrã dos comprovativos de
pagamento -- Tesseract, local, dentro do próprio container da API.

Local de propósito: a captura de ecrã tem o nome e a conta de quem pagou, e
nunca sai dos nossos servidores para uma API de terceiros. O Tesseract
(`tesseract-ocr` + `tesseract-ocr-por`) é instalado na imagem Docker
(`infra/docker/api.Dockerfile`) e no CI.

O `ValidacaoComprovativoService` depende do `LeitorOcr` (Protocol), não do
Tesseract -- os testes do service usam um leitor falso; o Tesseract real é
exercitado em `tests/core/test_ocr.py` (salta se o binário não existir).
"""

import logging
from dataclasses import dataclass
from typing import Protocol

from PIL import Image

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class TextoOcr:
    texto: str
    # Confiança média das palavras lidas, 0-100 (ponderada pelo tamanho).
    confianca: float


class OcrIndisponivelError(Exception):
    """O motor de OCR não está instalado ou falhou -- nunca é motivo para
    rejeitar um comprovativo, só para o mandar para revisão manual."""


class LeitorOcr(Protocol):
    def ler(self, imagem: Image.Image) -> TextoOcr: ...


class TesseractLeitorOcr:
    def __init__(self, idiomas: str = "por+eng", timeout_segundos: int = 20) -> None:
        self._idiomas = idiomas
        self._timeout = timeout_segundos

    def ler(self, imagem: Image.Image) -> TextoOcr:
        import pytesseract  # import tardio: a API arranca mesmo sem o pacote

        try:
            dados = pytesseract.image_to_data(
                imagem,
                lang=self._idiomas,
                config="--psm 6",
                output_type=pytesseract.Output.DICT,
                timeout=self._timeout,
            )
        except (pytesseract.TesseractNotFoundError, pytesseract.TesseractError, RuntimeError, OSError) as exc:
            logger.warning("OCR indisponível: %s", exc)
            raise OcrIndisponivelError(str(exc)) from exc

        linhas: dict[tuple[int, int, int], list[str]] = {}
        soma, peso = 0.0, 0
        for i, palavra in enumerate(dados["text"]):
            palavra = palavra.strip()
            if not palavra:
                continue
            chave = (dados["block_num"][i], dados["par_num"][i], dados["line_num"][i])
            linhas.setdefault(chave, []).append(palavra)
            conf = float(dados["conf"][i])
            if conf >= 0:
                soma += conf * len(palavra)
                peso += len(palavra)
        texto = "\n".join(" ".join(p) for _, p in sorted(linhas.items()))
        return TextoOcr(texto=texto, confianca=soma / peso if peso else 0.0)
