"""Leitura de um comprovativo em imagem (captura de ecrã do Multicaixa Express
ou da app do banco) -- funções puras, sem base de dados nem rede, usadas pelo
`ValidacaoComprovativoService`. O texto da imagem sai do OCR
(`app/core/ocr.py`); aqui só se prepara a imagem e se olha para o ficheiro.

Anti-fraude que se consegue ver numa imagem:

- **metadados de edição** (EXIF `Software`, XMP `CreatorTool`, `Software`
  de um PNG) -- Photoshop, GIMP, Canva, Snapseed...; uma captura de ecrã de
  um telemóvel não traz nada disto;
- **hash perceptual** (dHash 16×16, 256 bits): cortar dois píxeis,
  recomprimir ou mudar o formato da mesma captura muda o SHA-256 mas quase
  não muda este hash. Duas capturas *diferentes* do mesmo ecrã da mesma app
  também ficam parecidas (só mudam os números) -- por isso uma imagem quase
  igual a outra já usada vai para revisão manual, nunca é rejeitada só por
  isto. A garantia forte contra reenvio continua a ser o número da operação
  (índice único na base de dados).

O que isto não apanha: uma captura editada e depois fotografada ou
recapturada não tem metadados nenhuns. Uma imagem prova ainda menos do que
um PDF -- ver `PAYMENT_AUTO_APROVAR_IMAGENS`.
"""

import io
import re
from dataclasses import dataclass

from PIL import Image, ImageOps, UnidentifiedImageError

from app.services.comprovativo_texto import editor_suspeito

# Uma captura de ecrã de telemóvel tem 2-4 megapíxeis. Mais do que isto é
# desnecessário para ler um comprovativo, e protege contra "bombas de
# descompressão" (um PNG pequeno que se expande para gigabytes).
MAX_PIXEIS = 25_000_000
# Para o OCR: abaixo disto amplia-se (texto pequeno lê-se mal), acima reduz-se
# (mais lento sem ganhar precisão).
LARGURA_MINIMA_OCR = 1200
LARGURA_MAXIMA_OCR = 2200
# Distância de Hamming (em 256 bits) até à qual duas imagens contam como "a
# mesma captura" (cortada, recomprimida, noutro formato).
LIMIAR_HASH_PERCEPTUAL = 20

TIPO_PDF = "pdf"
TIPOS_IMAGEM = ("png", "jpeg", "webp")


class ImagemIlegivelError(Exception):
    pass


def detectar_tipo(conteudo: bytes) -> str | None:
    """Pelos bytes (magic numbers), nunca pela extensão nem pelo content-type
    que o browser diz."""
    inicio = conteudo.lstrip()[:16]
    if inicio.startswith(b"%PDF-"):
        return TIPO_PDF
    if conteudo.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if conteudo.startswith(b"\xff\xd8\xff"):
        return "jpeg"
    if conteudo[:4] == b"RIFF" and conteudo[8:12] == b"WEBP":
        return "webp"
    return None


@dataclass(frozen=True)
class ImagemLida:
    imagem: Image.Image
    formato: str
    largura: int
    altura: int
    metadados: dict[str, str]


# EXIF: Software, ProcessingSoftware, Artist, Make, Model, DateTime.
_TAGS_EXIF = {0x0131: "Software", 0x000B: "ProcessingSoftware", 0x013B: "Artist", 0x010F: "Make", 0x0110: "Model", 0x0132: "DateTime"}
_CREATOR_TOOL = re.compile(r"CreatorTool(?:>|=\")([^<\"]{1,200})")


def _metadados(img: Image.Image) -> dict[str, str]:
    meta: dict[str, str] = {}
    try:
        exif = img.getexif()
    except (OSError, ValueError, KeyError, TypeError, SyntaxError):  # EXIF corrompido não impede ler a imagem
        exif = {}
    for tag, nome in _TAGS_EXIF.items():
        valor = exif.get(tag)
        if valor:
            meta[nome] = str(valor)[:200]
    for chave in ("Software", "Comment", "Description", "Author"):
        valor = img.info.get(chave)
        if isinstance(valor, bytes):
            valor = valor.decode("latin-1", "replace")
        if valor:
            meta.setdefault(chave, str(valor)[:200])
    xmp = img.info.get("XML:com.adobe.xmp") or img.info.get("xmp")
    if isinstance(xmp, bytes):
        xmp = xmp.decode("utf-8", "replace")
    if xmp:
        m = _CREATOR_TOOL.search(xmp)
        if m:
            meta["CreatorTool"] = m.group(1)
        if "photoshop:" in xmp.lower():
            meta.setdefault("XMP", "photoshop")
    return meta


def abrir_imagem(conteudo: bytes) -> ImagemLida:
    Image.MAX_IMAGE_PIXELS = MAX_PIXEIS
    try:
        with Image.open(io.BytesIO(conteudo)) as verificar:
            verificar.verify()  # estrutura do ficheiro (CRC do PNG, etc.)
        img = Image.open(io.BytesIO(conteudo))
        # Antes de descodificar: o Pillow só recusa sozinho acima do dobro do
        # limite, e até lá descodificaria a imagem inteira em memória.
        if img.width * img.height > MAX_PIXEIS:
            raise ImagemIlegivelError("imagem demasiado grande")
        formato = (img.format or "").lower()
        metadados = _metadados(img)
        img = ImageOps.exif_transpose(img)
        img.load()
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError, SyntaxError, ValueError) as exc:
        raise ImagemIlegivelError(str(exc)) from exc
    return ImagemLida(
        imagem=img.convert("RGB"),
        formato=formato,
        largura=img.width,
        altura=img.height,
        metadados=metadados,
    )


def editor_suspeito_imagem(metadados: dict[str, str]) -> str | None:
    return editor_suspeito(" ".join(metadados.values()))


def hash_perceptual(img: Image.Image) -> str:
    """dHash 16×16 (256 bits, 64 caracteres hex): para cada linha de uma
    miniatura 17×16 em tons de cinzento, cada bit diz se o píxel é mais claro
    do que o vizinho da direita."""
    mini = img.convert("L").resize((17, 16), Image.Resampling.LANCZOS)
    pix = mini.tobytes()  # modo "L": um byte por píxel
    bits = 0
    for linha in range(16):
        for coluna in range(16):
            esquerda = pix[linha * 17 + coluna]
            direita = pix[linha * 17 + coluna + 1]
            bits = (bits << 1) | (1 if esquerda > direita else 0)
    return f"{bits:064x}"


def distancia_hamming(a: str, b: str) -> int:
    return (int(a, 16) ^ int(b, 16)).bit_count()


def preparar_para_ocr(img: Image.Image) -> Image.Image:
    """Tons de cinzento, texto escuro sobre fundo claro (o modo escuro das
    apps inverte-se), contraste esticado e largura num intervalo em que o
    OCR lê bem."""
    cinza = img.convert("L")
    histograma = cinza.histogram()
    media = sum(i * n for i, n in enumerate(histograma)) / max(1, sum(histograma))
    if media < 110:
        cinza = ImageOps.invert(cinza)
    cinza = ImageOps.autocontrast(cinza, cutoff=1)
    if cinza.width < LARGURA_MINIMA_OCR or cinza.width > LARGURA_MAXIMA_OCR:
        alvo = LARGURA_MINIMA_OCR if cinza.width < LARGURA_MINIMA_OCR else LARGURA_MAXIMA_OCR
        cinza = cinza.resize(
            (alvo, max(1, round(cinza.height * alvo / cinza.width))), Image.Resampling.LANCZOS
        )
    return cinza
