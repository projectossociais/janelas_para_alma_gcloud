"""Leitura de um comprovativo bancário em PDF -- função pura, sem base de
dados nem rede, usada pelo `ValidacaoComprovativoService`.

`ler_pdf` abre o ficheiro (pypdf) e devolve o texto, os metadados, os sinais
de adulteração que se vêem na estrutura do ficheiro e, para um PDF que é só
uma imagem colada (captura de ecrã exportada, digitalização), a maior
imagem lá dentro -- essa vai ao OCR (`comprovativo_imagem.py`). O que o
texto diz é lido em `comprovativo_texto.py`.
"""

import io
import logging
import re
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta, timezone

from PIL import Image
from pypdf import PdfReader
from pypdf.errors import PdfReadError

from app.services.comprovativo_texto import editor_suspeito as _editor_em_texto

logger = logging.getLogger(__name__)

# Mais páginas do que isto já não é um comprovativo de uma operação.
MAX_PAGINAS_LIDAS = 5

# Modo de renderização 3 = texto invisível. É o que um OCR põe por cima de
# uma imagem digitalizada -- um comprovativo gerado pela app nunca tem isto.
_TEXTO_INVISIVEL = re.compile(rb"(?<![\d.])3\s+Tr\b")


@dataclass(frozen=True)
class PdfLido:
    texto: str
    metadados: dict[str, str]
    paginas: int
    texto_invisivel: bool
    # Mais do que uma secção `%%EOF` num PDF não linearizado = o ficheiro
    # foi gravado outra vez por cima do original (actualização incremental).
    actualizacoes_incrementais: int
    cifrado: bool
    # A maior imagem das primeiras páginas (None se não houver nenhuma) --
    # para um PDF sem texto nativo ou com texto invisível, é o que se lê.
    maior_imagem: Image.Image | None = None


class PdfIlegivelError(Exception):
    """O ficheiro diz ser PDF mas o pypdf não o consegue abrir."""


class PdfCifradoError(Exception):
    """PDF protegido por password que não abre com a password vazia."""


def ler_pdf(conteudo: bytes) -> PdfLido:
    try:
        leitor = PdfReader(io.BytesIO(conteudo), strict=False)
        cifrado = leitor.is_encrypted
        if cifrado:
            # Muitos geradores cifram só para restringir a impressão/cópia, com
            # a password de abertura vazia -- esses lêem-se normalmente.
            try:
                if not leitor.decrypt(""):
                    raise PdfCifradoError
            except PdfCifradoError:
                raise
            except Exception as exc:  # algoritmo não suportado, etc.
                raise PdfCifradoError from exc

        paginas = leitor.pages
        n_paginas = len(paginas)
        partes: list[str] = []
        invisivel = False
        maior: Image.Image | None = None
        for pagina in list(paginas)[:MAX_PAGINAS_LIDAS]:
            partes.append(pagina.extract_text() or "")
            conteudo_pagina = pagina.get_contents()
            if conteudo_pagina is not None and _TEXTO_INVISIVEL.search(conteudo_pagina.get_data()):
                invisivel = True
            maior = _maior(maior, _imagens_da_pagina(pagina))

        bruto = leitor.metadata or {}
        metadados = {
            chave: str(bruto.get(f"/{chave}"))
            for chave in ("Producer", "Creator", "CreationDate", "ModDate")
            if bruto.get(f"/{chave}") is not None
        }
    except (PdfCifradoError, PdfIlegivelError):
        raise
    except (PdfReadError, ValueError, KeyError, TypeError, AttributeError, OSError) as exc:
        raise PdfIlegivelError(str(exc)) from exc

    linearizado = b"/Linearized" in conteudo[:2048]
    secoes_eof = conteudo.count(b"%%EOF")
    incrementais = max(0, secoes_eof - (2 if linearizado else 1))

    return PdfLido(
        texto="\n".join(partes).strip(),
        metadados=metadados,
        paginas=n_paginas,
        texto_invisivel=invisivel,
        actualizacoes_incrementais=incrementais,
        cifrado=cifrado,
        maior_imagem=maior,
    )


_ERROS_IMAGEM_PDF = (PdfReadError, OSError, ValueError, KeyError, TypeError, AttributeError, NotImplementedError)


def _imagens_da_pagina(pagina) -> list[Image.Image]:
    """Imagens de uma página. Um filtro de imagem que o pypdf/Pillow não
    saibam descodificar não deita a leitura abaixo -- só fica de fora."""
    imagens = []
    try:
        for ficheiro in pagina.images:
            try:
                imagens.append(ficheiro.image)
            except _ERROS_IMAGEM_PDF:  # descodificação de uma imagem concreta
                logger.info("imagem do PDF que não se conseguiu descodificar: %s", ficheiro.name)
    except _ERROS_IMAGEM_PDF:  # a página não tem /Resources legíveis
        logger.info("página do PDF sem imagens legíveis")
    return imagens


def _maior(actual: Image.Image | None, novas: list[Image.Image]) -> Image.Image | None:
    for img in novas:
        if actual is None or img.width * img.height > actual.width * actual.height:
            actual = img
    return actual


def editor_suspeito(metadados: dict[str, str]) -> str | None:
    """Nome da ferramenta de edição encontrada no /Producer ou /Creator."""
    return _editor_em_texto(f"{metadados.get('Producer', '')} {metadados.get('Creator', '')}")


def data_de_metadado_pdf(valor: str | None) -> datetime | None:
    """`D:20261014093012+01'00'` -> datetime com fuso (UTC se não houver)."""
    if not valor:
        return None
    m = re.match(
        r"D?:?(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?\s*(Z|[+-]\d{2}'?\d{2}'?)?", valor.strip()
    )
    if not m:
        return None
    ano, mes, dia, hora, minuto, segundo, fuso = m.groups()
    tz = UTC
    if fuso and fuso != "Z":
        digitos = fuso.replace("'", "")
        sinal = 1 if digitos[0] == "+" else -1
        tz = timezone(sinal * timedelta(hours=int(digitos[1:3]), minutes=int(digitos[3:5] or 0)))
    try:
        return datetime(
            int(ano), int(mes), int(dia), int(hora or 0), int(minuto or 0), int(segundo or 0), tzinfo=tz
        )
    except ValueError:
        return None
