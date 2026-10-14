"""Gera PDFs reais (bytes que o pypdf abre) para os testes dos comprovativos,
sem dependência nova: escreve os objectos e a tabela xref à mão.

Permite controlar o que a validação inspecciona -- texto, /Producer,
/Creator, datas dos metadados, texto invisível (modo 3) e actualizações
incrementais -- para reproduzir cada caso sem precisar de comprovativos
verdadeiros (que têm dados pessoais e não podem entrar no repositório).
"""

import io
from datetime import datetime, timedelta

from PIL import Image, ImageDraw, ImageFilter, ImageFont
from PIL.PngImagePlugin import PngInfo


def _escapar(linha: str) -> bytes:
    return (
        linha.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)").encode("cp1252")
    )


def _data_pdf(quando: datetime) -> str:
    return quando.strftime("D:%Y%m%d%H%M%S+01'00'")


def criar_pdf(
    linhas: list[str],
    producer: str | None = "BAI Directo",
    creator: str | None = "BAI Directo Mobile",
    criado_em: datetime | None = None,
    modificado_em: datetime | None = None,
    texto_invisivel: bool = False,
    actualizacao_incremental: bool = False,
    imagem: Image.Image | None = None,
) -> bytes:
    """`imagem` põe uma imagem a ocupar a página (um PDF que é só uma
    captura de ecrã ou uma digitalização); com `linhas=[]` fica sem texto."""
    criado_em = criado_em or datetime(2026, 10, 14, 9, 30)
    modificado_em = modificado_em or criado_em

    conteudo = [b"q 595 0 0 842 0 0 cm /Im1 Do Q"] if imagem is not None else []
    conteudo += [b"BT", b"/F1 10 Tf", b"14 TL", b"50 800 Td"]
    if texto_invisivel:
        conteudo.append(b"3 Tr")
    for linha in linhas:
        conteudo.append(b"(" + _escapar(linha) + b") Tj T*")
    conteudo.append(b"ET")
    stream = b"\n".join(conteudo)

    info = []
    if producer is not None:
        info.append(f"/Producer ({producer})")
    if creator is not None:
        info.append(f"/Creator ({creator})")
    info.append(f"/CreationDate ({_data_pdf(criado_em)})")
    info.append(f"/ModDate ({_data_pdf(modificado_em)})")

    objectos = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >>"
        + (b" /XObject << /Im1 7 0 R >>" if imagem is not None else b"")
        + b" >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
        ("<< " + " ".join(info) + " >>").encode("cp1252"),
    ]
    if imagem is not None:
        jpeg = io.BytesIO()
        imagem.convert("RGB").save(jpeg, format="JPEG", quality=92)
        dados = jpeg.getvalue()
        objectos.append(
            f"<< /Type /XObject /Subtype /Image /Width {imagem.width} /Height {imagem.height} "
            f"/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length {len(dados)} >>\nstream\n".encode()
            + dados
            + b"\nendstream"
        )

    saida = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = []
    for i, obj in enumerate(objectos, start=1):
        offsets.append(len(saida))
        saida += f"{i} 0 obj\n".encode() + obj + b"\nendobj\n"
    xref = len(saida)
    saida += f"xref\n0 {len(objectos) + 1}\n0000000000 65535 f \n".encode()
    for off in offsets:
        saida += f"{off:010d} 00000 n \n".encode()
    saida += (
        f"trailer\n<< /Size {len(objectos) + 1} /Root 1 0 R /Info 6 0 R >>\n"
        f"startxref\n{xref}\n%%EOF\n"
    ).encode()

    if actualizacao_incremental:
        # Uma segunda gravação por cima (o que um editor faz ao "guardar").
        info_nova = f"6 0 obj\n<< /Producer ({producer}) >>\nendobj\n".encode()
        off = len(saida)
        saida += info_nova
        xref2 = len(saida)
        saida += (
            f"xref\n6 1\n{off:010d} 00000 n \ntrailer\n<< /Size {len(objectos) + 1} /Root 1 0 R /Info 6 0 R "
            f"/Prev {xref} >>\nstartxref\n{xref2}\n%%EOF\n"
        ).encode()
    return bytes(saida)


# Dados fictícios -- nunca os da conta real.
IBAN_OFICIAL = "AO06 0040 0000 1234 5678 9012 3"
TELEFONE_OFICIAL = "923000111"
NOME_OFICIAL = "MARIA EXEMPLO TITULAR"


def linhas_bai(
    montante: str = "15.000,00 Kz",
    iban: str = "AO06.0040.0000.1234.5678.9012.3",
    operacao: str = "202610140001234",
    data: str = "14/10/2026 09:25",
    estado: str = "Operação efectuada com sucesso",
) -> list[str]:
    """Texto típico de um comprovativo de transferência do BAI Directo."""
    return [
        "BANCO ANGOLANO DE INVESTIMENTOS",
        "BAI Directo - Comprovativo de Transferência",
        f"N.º de Operação: {operacao}",
        f"Data da Operação: {data}",
        "Conta Ordenante: AO06 0040 0000 1111 2222 3333 4",
        "Beneficiário: Maria Exemplo Titular",
        f"IBAN Beneficiário: {iban}",
        f"Montante: {montante}",
        "Descritivo: Premium Janelas",
        estado,
    ]


def linhas_express(
    montante: str = "15 000,00 AOA",
    telefone: str = "+244 923 000 111",
    transaccao: str = "MCX88776655",
    data: str = "2026-10-14 09:12:11",
) -> list[str]:
    """Texto típico de um comprovativo do Multicaixa Express (EMIS)."""
    return [
        "MULTICAIXA EXPRESS",
        "EMIS - Empresa Interbancária de Serviços",
        "Transferência para telemóvel",
        f"Transacção: {transaccao}",
        f"Data: {data}",
        f"Destino: {telefone}",
        f"Valor: {montante}",
        "Estado: Concluída",
    ]


def daqui_a(dias: int, base: datetime | None = None) -> datetime:
    return (base or datetime(2026, 10, 14, 9, 30)) + timedelta(days=dias)


# --- capturas de ecrã -----------------------------------------------------------

_FONTE = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"


def desenhar_ecra(linhas: list[str], escuro: bool = False, largura: int = 1080, altura: int = 1500) -> Image.Image:
    """Um ecrã de telemóvel com o texto do comprovativo (barra de topo
    colorida, como as apps dos bancos)."""
    fundo, letra = ((18, 18, 18), (235, 235, 235)) if escuro else ((255, 255, 255), (30, 30, 30))
    img = Image.new("RGB", (largura, altura), fundo)
    desenho = ImageDraw.Draw(img)
    try:
        fonte = ImageFont.truetype(_FONTE, 40)
    except OSError:  # sem DejaVu: a de omissão do Pillow (o OCR falso não precisa de a ler)
        fonte = ImageFont.load_default()
    desenho.rectangle([0, 0, largura, 90], fill=(0, 90, 160))
    y = 120
    for linha in linhas:
        desenho.text((60, y), linha, font=fonte, fill=letra)
        y += 78
    return img


def em_bytes(img: Image.Image, formato: str = "PNG", software: str | None = None) -> bytes:
    """Grava a imagem. `software` põe a assinatura de um editor nos
    metadados (PNG: chunk `Software`; JPEG/WebP: EXIF `Software`)."""
    saida = io.BytesIO()
    if formato == "PNG":
        info = PngInfo()
        if software:
            info.add_text("Software", software)
        img.save(saida, format="PNG", pnginfo=info)
    else:
        exif = Image.Exif()
        if software:
            exif[0x0131] = software
        img.save(saida, format=formato, quality=90, exif=exif.tobytes())
    return saida.getvalue()


def desfocar(img: Image.Image, raio: int = 9) -> Image.Image:
    return img.filter(ImageFilter.GaussianBlur(raio))
