"""Leitura e extracção de um comprovativo bancário em PDF (BAI Directo e
Multicaixa Express) -- funções puras, sem base de dados nem rede, usadas
pelo `ValidacaoComprovativoService`.

Duas metades:

1. `ler_pdf` abre o ficheiro (pypdf) e devolve o texto, os metadados e os
   sinais de adulteração que se conseguem ver na estrutura do ficheiro.
2. `extrair_*` procuram no texto o que o comprovativo diz: origem, montante,
   número da operação, data e estado.

Os padrões cobrem os rótulos habituais em Angola ("N.º de Operação",
"Transacção", "Montante", "15.000,00 Kz"...). O texto é normalizado antes
(maiúsculas, sem acentos -- `º` passa a `O`), para um mesmo padrão servir a
"Transacção", "Transação" e "TRANSACCAO". Um layout que os padrões não
reconheçam nunca é aprovado: o campo fica `None` e o service manda o
comprovativo para revisão manual.

**Limite que nenhuma destas verificações resolve:** o texto e os metadados
de um PDF podem ser escritos por qualquer pessoa com as ferramentas certas.
Isto apanha edições grosseiras (Canva, Word, iLovePDF, texto por cima de uma
imagem) e erros honestos (valor errado, conta errada, comprovativo velho);
não prova que a transferência existiu. Só o extracto da conta prova isso --
ver o "por reconciliar" do painel de admin.
"""

import io
import re
import unicodedata
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation

from pypdf import PdfReader
from pypdf.errors import PdfReadError

# Angola não tem hora de Verão: UTC+1 todo o ano.
FUSO_LUANDA = timezone(timedelta(hours=1), name="Africa/Luanda")

# Mais páginas do que isto já não é um comprovativo de uma operação.
MAX_PAGINAS_LIDAS = 5

# Ferramentas de edição ou conversão que nenhum banco usa para gerar um
# comprovativo. Procuradas no /Producer e no /Creator, sem distinguir
# maiúsculas. `\b` em "word" para não apanhar, por exemplo, "password".
EDITORES_SUSPEITOS: tuple[tuple[str, str], ...] = (
    ("Canva", r"canva"),
    ("Photoshop", r"photoshop"),
    ("Illustrator", r"illustrator"),
    ("Microsoft Word", r"\bword\b"),
    ("LibreOffice", r"libreoffice"),
    ("OpenOffice", r"openoffice"),
    ("iLovePDF", r"ilovepdf"),
    ("Smallpdf", r"smallpdf"),
    ("Sejda", r"sejda"),
    ("PDF24", r"pdf24"),
    ("PDFescape", r"pdfescape"),
    ("pdfFiller", r"pdffiller"),
    ("PDFelement", r"pdfelement"),
    ("Inkscape", r"inkscape"),
    ("GIMP", r"\bgimp\b"),
    ("Adobe Acrobat (edição)", r"acrobat\s+pro"),
)

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
    avisos: tuple[str, ...] = field(default_factory=tuple)


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
        for pagina in list(paginas)[:MAX_PAGINAS_LIDAS]:
            partes.append(pagina.extract_text() or "")
            conteudo_pagina = pagina.get_contents()
            if conteudo_pagina is not None and _TEXTO_INVISIVEL.search(conteudo_pagina.get_data()):
                invisivel = True

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
    )


def editor_suspeito(metadados: dict[str, str]) -> str | None:
    """Nome da ferramenta de edição encontrada no /Producer ou /Creator."""
    alvo = f"{metadados.get('Producer', '')} {metadados.get('Creator', '')}".lower()
    for nome, padrao in EDITORES_SUSPEITOS:
        if re.search(padrao, alvo):
            return nome
    return None


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


# --- texto --------------------------------------------------------------------


def normalizar(texto: str) -> str:
    """Maiúsculas, sem acentos (NFKD: `º` -> `O`, `ç` -> `C`), espaços simples."""
    sem_acentos = "".join(
        c for c in unicodedata.normalize("NFKD", texto) if not unicodedata.combining(c)
    )
    return re.sub(r"[ \t ]+", " ", sem_acentos.upper())


def compactar(texto: str) -> str:
    """Sem espaços, pontos nem hífens -- para comparar IBANs e telefones
    escritos de formas diferentes (`AO06.0040.0000...` / `AO06 0040 0000...`)."""
    return re.sub(r"[\s.\- ]", "", normalizar(texto))


ORIGEM_BAI = "bai_directo"
ORIGEM_MCX = "multicaixa_express"
ORIGEM_OUTRA = "outro"


def extrair_origem(texto_normalizado: str) -> str:
    # Multicaixa Express primeiro: uma transferência feita no Express para
    # uma conta BAI menciona o BAI como banco de destino.
    if re.search(r"MULTICAIXA\s*EXPRESS|\bMCX\s*EXPRESS\b|\bEMIS\b", texto_normalizado):
        return ORIGEM_MCX
    if re.search(r"BAI\s*DIRECTO|BAI\s*DIRETO|BANCO ANGOLANO DE INVESTIMENTOS|\bBAI\b", texto_normalizado):
        return ORIGEM_BAI
    return ORIGEM_OUTRA


def destinatario_coincide(
    texto: str, iban: str, telefone: str, palavras_nome: str
) -> str | None:
    """O que coincidiu com a conta oficial (IBAN, telefone ou nome), ou None.

    O IBAN conta inteiro (`AO06...`) ou sem o prefixo do país e os dígitos de
    controlo -- alguns comprovativos mostram só o número da conta/NBA. O
    telefone conta com ou sem o indicativo 244. O nome conta quando todas as
    palavras configuradas aparecem."""
    compacto = compactar(texto)
    iban_c = compactar(iban)
    if iban_c:
        if iban_c in compacto:
            return iban_c
        nba = iban_c[4:] if iban_c.startswith("AO") else iban_c
        if len(nba) >= 15 and nba in compacto:
            return iban_c
    digitos_tel = re.sub(r"\D", "", telefone)[-9:]
    if len(digitos_tel) == 9 and re.search(rf"(?<!\d)(?:\+?244)?{digitos_tel}(?!\d)", compacto):
        return digitos_tel
    palavras = [p for p in normalizar(palavras_nome).split() if p]
    if palavras:
        normalizado = normalizar(texto)
        if all(re.search(rf"\b{re.escape(p)}\b", normalizado) for p in palavras):
            return " ".join(palavras)
    return None


_NUMERO = r"(\d{1,3}(?:[ .,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)"
_MOEDA = r"(?:KZS?|AOA|KWANZAS?)"
# "Data-valor" é uma data, não um montante -- daí o lookbehind; e o número
# não pode continuar como data (`14/10`) nem hora (`09:30`).
_MONTANTE_ROTULADO = re.compile(
    r"(?<!DATA )(?<!DATA-)\b(?:MONTANTE|VALOR|IMPORTANCIA|QUANTIA)\b"
    r"(?:\s+(?:DA|DE|DO)\s+(?:TRANSFERENCIA|OPERACAO|PAGAMENTO|TRANSACCAO|TRANSACAO))?"
    rf"\s*(?:\(\s*{_MOEDA}\s*\))?\s*[:\-]?\s*(?:{_MOEDA}\s*)?{_NUMERO}(?![/:\-]?\d)"
)
_MONTANTE_COM_MOEDA = re.compile(rf"{_NUMERO}\s*{_MOEDA}\b|\b{_MOEDA}\s*{_NUMERO}")


def converter_montante(valor: str) -> Decimal | None:
    """`15.000,00` / `15 000,00` / `15,000.00` / `15000,00` / `15.000` -> 15000.

    O último separador é decimal só quando é seguido de 1 ou 2 dígitos; com 3
    dígitos é separador de milhares (`15.000` e `15,000` são quinze mil)."""
    valor = valor.strip()
    m = re.fullmatch(r"(.*?)[.,](\d{1,2})", valor)
    inteiro, decimal = (m.group(1), m.group(2)) if m else (valor, "0")
    digitos = re.sub(r"\D", "", inteiro)
    if not digitos:
        return None
    try:
        return Decimal(f"{int(digitos)}.{decimal}").quantize(Decimal("0.01"))
    except InvalidOperation:
        return None


def extrair_montante(texto_normalizado: str) -> Decimal | None:
    """O montante rotulado (Montante/Valor/Importância). Sem rótulo, o único
    valor com moeda que aparece -- se aparecerem vários diferentes (montante,
    comissão, saldo...), não adivinha: devolve None (revisão manual)."""
    rotulado = _MONTANTE_ROTULADO.search(texto_normalizado)
    if rotulado:
        return converter_montante(rotulado.group(1))
    valores = {
        v
        for m in _MONTANTE_COM_MOEDA.finditer(texto_normalizado)
        if (v := converter_montante(m.group(1) or m.group(2))) is not None
    }
    return valores.pop() if len(valores) == 1 else None


_REFERENCIA = re.compile(
    r"(?:"
    r"N\.?\s*O?\.?\s*(?:DE\s+|DA\s+)?(?:OPERACAO|TRANSACCAO|TRANSACAO|REFERENCIA|DOCUMENTO|COMPROVATIVO)"
    r"|NUMERO\s+(?:DE\s+|DA\s+|DO\s+)?(?:OPERACAO|TRANSACCAO|TRANSACAO|REFERENCIA|DOCUMENTO|COMPROVATIVO)"
    r"|ID\.?\s*(?:DE\s+|DA\s+)?(?:OPERACAO|TRANSACCAO|TRANSACAO)"
    r"|REFERENCIA(?:\s+DA\s+OPERACAO)?|REF\.|DOCUMENTO|TRANSACCAO|TRANSACAO|OPERACAO"
    r")"
    r"\s*(?:N\.?\s*O\.?\s+)?[:#\-]?\s*([A-Z0-9][A-Z0-9/\-]{5,40})"
)


def extrair_referencia(texto_normalizado: str, ignorar: tuple[str, ...] = ()) -> str | None:
    """Número da operação/transacção. Só conta um valor com pelo menos um
    dígito (`TRANSACCAO EFECTUADA` não é uma referência) que não seja um
    dos valores a ignorar (o IBAN/telefone de destino, por exemplo)."""
    ignorar_c = {compactar(v) for v in ignorar if v}
    for m in _REFERENCIA.finditer(texto_normalizado):
        candidato = m.group(1).strip("-/")
        if not re.search(r"\d", candidato) or len(candidato) < 6:
            continue
        if compactar(candidato) in ignorar_c or re.fullmatch(r"\d{2}[/-]\d{2}[/-]\d{4}", candidato):
            continue
        return candidato
    return None


_DATA_DMY = r"(\d{2})[/-](\d{2})[/-](\d{4})"
_DATA_YMD = r"(\d{4})-(\d{2})-(\d{2})"
_HORA = r"(?:[ ,T]+(?:AS\s+)?(\d{2}):(\d{2})(?::(\d{2}))?)?"
_DATAS = re.compile(rf"\b(?:{_DATA_DMY}|{_DATA_YMD}){_HORA}")


def _datas_em(texto: str) -> list[datetime]:
    encontradas = []
    for m in _DATAS.finditer(texto):
        d1, m1, a1, a2, m2, d2, hh, mm, ss = m.groups()
        dia, mes, ano = (d1, m1, a1) if d1 else (d2, m2, a2)
        try:
            encontradas.append(
                datetime(int(ano), int(mes), int(dia), int(hh or 0), int(mm or 0), int(ss or 0), tzinfo=FUSO_LUANDA)
            )
        except ValueError:
            continue
    return encontradas


def extrair_data(texto_normalizado: str) -> datetime | None:
    """Data da operação (hora de Luanda). Preferência: a data a seguir a
    "Data da operação/transacção/execução", depois a seguir a qualquer
    "Data", por fim a primeira data do texto."""
    for rotulo in (
        r"DATA\s+(?:DA|DE)\s+(?:OPERACAO|TRANSACCAO|TRANSACAO|EXECUCAO|TRANSFERENCIA|PAGAMENTO)",
        r"DATA",
    ):
        for m in re.finditer(rotulo, texto_normalizado):
            datas = _datas_em(texto_normalizado[m.end() : m.end() + 60])
            if datas:
                return datas[0]
    datas = _datas_em(texto_normalizado)
    return datas[0] if datas else None


_ESTADO_FALHADO = re.compile(
    r"\bNAO\s+(?:EFECTUAD|EFETUAD|EXECUTAD|CONCLUID|REALIZAD)|\bSEM\s+SUCESSO\b|\bINSUCESSO\b"
    r"|\bAGENDAD[AO]S?\b|\bPENDENTES?\b|\bREJEITAD[AO]\b|\bRECUSAD[AO]\b|\bFALHAD[AO]\b"
    r"|\bCANCELAD[AO]\b|\bANULAD[AO]\b|\bRASCUNHO\b|\bEM\s+PROCESSAMENTO\b"
)
_ESTADO_SUCESSO = re.compile(
    r"\b(?:EXECUTAD|EFECTUAD|EFETUAD|CONFIRMAD|CONCLUID|REALIZAD)[AO]S?\b|\bSUCESSO\b"
)


def extrair_estado(texto_normalizado: str) -> str | None:
    """"concluida", "nao_concluida" ou None (o comprovativo não diz)."""
    if _ESTADO_FALHADO.search(texto_normalizado):
        return "nao_concluida"
    if _ESTADO_SUCESSO.search(texto_normalizado):
        return "concluida"
    return None
