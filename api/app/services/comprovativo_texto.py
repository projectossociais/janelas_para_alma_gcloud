"""O que um comprovativo bancário diz, a partir do seu texto -- funções puras,
sem base de dados nem rede, usadas pelo `ValidacaoComprovativoService`.

O texto vem de um PDF (camada de texto nativa, `comprovativo_pdf.py`) ou de
uma imagem lida por OCR (captura de ecrã, `comprovativo_imagem.py`); as
regras são as mesmas. A conta de destino é sempre a do projecto (no BAI),
mas quem paga pode usar **qualquer banco angolano** ou o Multicaixa Express.

O texto é normalizado antes (maiúsculas, sem acentos -- `º` passa a `O`),
para um mesmo padrão servir a "Transacção", "Transação" e "TRANSACCAO". Um
layout que os padrões não reconheçam nunca é aprovado: o campo fica `None`
e o service manda o comprovativo para revisão manual.

**Limite que nenhuma destas verificações resolve:** o texto de um PDF ou de
uma captura de ecrã pode ser escrito por qualquer pessoa. Isto apanha
edições grosseiras e erros honestos; não prova que a transferência existiu.
Só o extracto da conta prova isso -- ver `/admin/comprovativos`.
"""

import re
import unicodedata
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation

# Angola não tem hora de Verão: UTC+1 todo o ano.
FUSO_LUANDA = timezone(timedelta(hours=1), name="Africa/Luanda")

# Ferramentas de edição ou conversão que nenhum banco usa para gerar um
# comprovativo, nem um telemóvel para gravar uma captura de ecrã. Procuradas
# no /Producer e /Creator de um PDF e no EXIF/XMP de uma imagem, sem
# distinguir maiúsculas. `\b` em "word" para não apanhar "password".
EDITORES_SUSPEITOS: tuple[tuple[str, str], ...] = (
    ("Canva", r"canva"),
    ("Photoshop", r"photoshop"),
    ("Illustrator", r"illustrator"),
    ("Lightroom", r"lightroom"),
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
    ("Snapseed", r"snapseed"),
    ("PicsArt", r"picsart"),
    ("Pixlr", r"pixlr"),
    ("Fotor", r"fotor"),
    ("Paint.NET", r"paint\.net"),
    ("Affinity", r"affinity\s+(?:photo|designer)"),
)


def editor_suspeito(texto: str) -> str | None:
    """Nome da ferramenta de edição encontrada em metadados, ou None."""
    alvo = texto.lower()
    for nome, padrao in EDITORES_SUSPEITOS:
        if re.search(padrao, alvo):
            return nome
    return None


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


# O OCR troca letras e dígitos parecidos. Só se aplica à procura de números
# (IBAN, conta, telefone) -- dos dois lados, por isso nunca cria uma
# coincidência que não existia.
_LETRAS_COMO_DIGITOS = str.maketrans({"O": "0", "D": "0", "Q": "0", "I": "1", "L": "1", "S": "5", "B": "8", "Z": "2"})


def _como_digitos(texto: str) -> str:
    return texto.translate(_LETRAS_COMO_DIGITOS)


# --- origem ---------------------------------------------------------------------

ORIGEM_BAI = "bai_directo"
ORIGEM_MCX = "multicaixa_express"
ORIGEM_OUTRA = "outro"

# Ordem importa: o Express primeiro (o mais explícito), depois os outros
# bancos, e o BAI no fim -- um comprovativo do BFA para a nossa conta
# menciona o BAI como banco de destino, por isso "BAI" sozinho não chega
# para dizer que foi o BAI a emitir. "BIC" sozinho também não serve: é o
# rótulo do código SWIFT ("BIC/SWIFT: BAIPAOLU") em muitos comprovativos.
PADROES_ORIGEM: tuple[tuple[str, str], ...] = (
    (ORIGEM_MCX, r"MULTICAIXA\s*EXPRESS|\bMCX\s*EXPRESS\b|\bEMIS\b|EMPRESA INTERBANCARIA DE SERVICOS"),
    ("bfa", r"BANCO DE FOMENTO ANGOLA|\bBFA\b"),
    ("bic", r"BANCO BIC|\bBIC\s*(?:NET|SMART|ONLINE|MOBILE)\b"),
    ("atlantico", r"MILLENNIUM ATLANTICO|BANCO (?:MILLENNIUM )?ATLANTICO|ATLANTICO DIRECTO|\bATLANTICO\b"),
    ("banco_sol", r"\bBANCO SOL\b|\bSOL NET\b"),
    ("standard_bank", r"STANDARD BANK"),
    ("keve", r"\bKEVE\b"),
    ("access_bank", r"ACCESS BANK"),
    ("bni", r"BANCO DE NEGOCIOS INTERNACIONAL|\bBNI\b"),
    ("caixa_angola", r"CAIXA GERAL ANGOLA|BANCO CAIXA GERAL|\bCAIXA ANGOLA\b"),
    (ORIGEM_BAI, r"BAI\s*DIRECTO|BAI\s*DIRETO|BANCO ANGOLANO DE INVESTIMENTOS|\bBAI\b"),
)

NOMES_ORIGEM = {
    ORIGEM_BAI: "BAI Directo",
    ORIGEM_MCX: "Multicaixa Express",
    "bfa": "BFA",
    "bic": "Banco BIC",
    "atlantico": "Millennium Atlântico",
    "banco_sol": "Banco Sol",
    "standard_bank": "Standard Bank",
    "keve": "Banco Keve",
    "access_bank": "Access Bank",
    "bni": "BNI",
    "caixa_angola": "Caixa Geral Angola",
    ORIGEM_OUTRA: "Origem desconhecida",
}


def extrair_origem(texto_normalizado: str) -> str:
    for origem, padrao in PADROES_ORIGEM:
        if re.search(padrao, texto_normalizado):
            return origem
    return ORIGEM_OUTRA


# --- destinatário ---------------------------------------------------------------


def destinatario_coincide(
    texto: str, iban: str, telefone: str, palavras_nome: str, ocr: bool = False
) -> str | None:
    """O que coincidiu com a conta oficial, ou None. Conta qualquer um de:

    - o IBAN inteiro (`AO06...`), com ou sem pontos/espaços;
    - o IBAN sem o prefixo do país e os dígitos de controlo (os 21 dígitos
      `0040...`, o NBA/NIB que muitos bancos mostram);
    - só o número da conta (os 11 dígitos a meio do NBA), sozinho;
    - o telefone do Express, com ou sem o indicativo 244 (Express P2P);
    - todas as palavras configuradas do nome do titular.

    `ocr=True` tolera as trocas típicas do OCR (`O`/`0`, `I`/`1`...)."""
    compacto = compactar(texto)
    numeros = _como_digitos(compacto) if ocr else compacto
    iban_c = compactar(iban)
    if iban_c:
        alvo = _como_digitos(iban_c) if ocr else iban_c
        if alvo in numeros:
            return iban_c
        nba = re.sub(r"\D", "", iban_c[4:] if iban_c.startswith("AO") else iban_c)
        if len(nba) >= 15 and nba in numeros:
            return iban_c
        if len(nba) == 21 and re.search(rf"(?<!\d){nba[8:19]}(?!\d)", numeros):
            return iban_c
    digitos_tel = re.sub(r"\D", "", telefone)[-9:]
    if len(digitos_tel) == 9 and re.search(rf"(?<!\d)(?:\+?244)?{digitos_tel}(?!\d)", numeros):
        return digitos_tel
    palavras = [p for p in normalizar(palavras_nome).split() if p]
    if palavras:
        normalizado = normalizar(texto)
        if all(re.search(rf"\b{re.escape(p)}\b", normalizado) for p in palavras):
            return " ".join(palavras)
    return None


# --- montante -------------------------------------------------------------------

_NUMERO = r"(\d{1,3}(?:[ .,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)"
_MOEDA = r"(?:KZS?|AOA|KWANZAS?)"
# "Data-valor" é uma data, não um montante -- daí o lookbehind; e o número
# não pode continuar como data (`14/10`) nem hora (`09:30`).
_MONTANTE_ROTULADO = re.compile(
    r"(?<!DATA )(?<!DATA-)\b(?:MONTANTE|VALOR|IMPORTANCIA|QUANTIA)\b"
    r"(?:\s+(?:DA|DE|DO)\s+(?:TRANSFERENCIA|OPERACAO|PAGAMENTO|TRANSACCAO|TRANSACAO))?"
    r"(?:\s+(?:TRANSFERIDO|ENVIADO|PAGO|A TRANSFERIR))?"
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


# --- referência -----------------------------------------------------------------

_ALVOS_REFERENCIA = r"(?:OPERACAO|TRANSACCAO|TRANSACAO|REFERENCIA|DOCUMENTO|COMPROVATIVO|CONTROLO|TRANSFERENCIA)"
_REFERENCIA = re.compile(
    r"(?:"
    rf"N\.?\s*O?\.?\s*(?:DE\s+|DA\s+|DO\s+)?{_ALVOS_REFERENCIA}"
    rf"|NUMERO\s+(?:DE\s+|DA\s+|DO\s+)?{_ALVOS_REFERENCIA}"
    r"|(?:ID|IDENTIFICADOR)\.?\s*(?:DE\s+|DA\s+|DO\s+)?(?:OPERACAO|TRANSACCAO|TRANSACAO|TRANSFERENCIA)"
    r"|CODIGO\s+(?:DE\s+|DA\s+|DO\s+)?(?:OPERACAO|TRANSACCAO|TRANSACAO|AUTENTICACAO|TRANSFERENCIA)"
    r"|REF\.?\s*(?:DA\s+|DE\s+)?(?:OPERACAO|TRANSACCAO|TRANSACAO)"
    r"|COMPROVATIVO\s+N\.?\s*O\.?"
    r"|AUTENTICACAO(?:\s+BANCARIA)?"
    r"|REFERENCIA(?:\s+DA\s+OPERACAO)?|REF\.|DOCUMENTO|TRANSACCAO|TRANSACAO|OPERACAO"
    r")"
    r"\s*(?:N\.?\s*O\.?\s+)?[:#\-]?\s*([A-Z0-9][A-Z0-9/\-]{5,40})"
)


_LETRAS_ENTRE_DIGITOS = re.compile(r"(?<=\d)[ODIL]+(?=\d)")
_PARA_DIGITO = str.maketrans({"O": "0", "D": "0", "I": "1", "L": "1"})


def canonizar_referencia(referencia: str) -> str:
    """O OCR lê às vezes `O` em vez de `0` (ou `I`/`L` em vez de `1`) no meio
    de um número -- canoniza-se antes de comparar e gravar, para o PDF e a
    captura de ecrã da mesma transferência baterem. Só entre dígitos: um
    prefixo de letras verdadeiro (`DOC...`, `MCX...`) fica como está."""
    return _LETRAS_ENTRE_DIGITOS.sub(lambda m: m.group(0).translate(_PARA_DIGITO), referencia)


def extrair_referencia(texto_normalizado: str, ignorar: tuple[str, ...] = ()) -> str | None:
    """Número da operação/transacção. Só conta um valor com pelo menos um
    dígito (`TRANSACCAO EFECTUADA` não é uma referência) que não seja uma
    data nem um dos valores a ignorar (o IBAN/telefone de destino)."""
    ignorar_c = {compactar(v) for v in ignorar if v}
    for m in _REFERENCIA.finditer(texto_normalizado):
        candidato = m.group(1).strip("-/")
        if not re.search(r"\d", candidato) or len(candidato) < 6:
            continue
        if compactar(candidato) in ignorar_c or re.fullmatch(r"\d{2}[/-]\d{2}[/-]\d{4}", candidato):
            continue
        return canonizar_referencia(candidato)
    return None


# --- data -----------------------------------------------------------------------

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


# --- estado ---------------------------------------------------------------------

ESTADO_CONCLUIDA = "concluida"
ESTADO_NAO_CONCLUIDA = "nao_concluida"
# Transferência interbancária (de outro banco para o BAI) já aceite pelo
# banco de origem mas ainda não liquidada: "Aceite", "Registada", "Em
# processamento". O dinheiro normalmente chega no mesmo dia, mas ainda pode
# falhar -- o service decide (`payment_aceitar_interbancario_pendente`).
ESTADO_EM_PROCESSAMENTO = "em_processamento"

_ESTADO_FALHADO = re.compile(
    r"\bNAO\s+(?:EFECTUAD|EFETUAD|EXECUTAD|CONCLUID|REALIZAD|PROCESSAD)|\bSEM\s+SUCESSO\b|\bINSUCESSO\b"
    r"|\bAGENDAD[AO]S?\b|\bREJEITAD[AO]\b|\bRECUSAD[AO]\b|\bFALHAD[AO]\b|\bFALHOU\b"
    r"|\bCANCELAD[AO]\b|\bANULAD[AO]\b|\bRASCUNHO\b|\bESTORNAD[AO]\b|\bDEVOLVID[AO]\b"
)
_ESTADO_EM_PROCESSAMENTO = re.compile(
    r"\bEM\s+PROCESSAMENTO\b|\bA\s+PROCESSAR\b|\bPENDENTES?\b|\bACEITES?\b|\bREGISTAD[AO]\b|\bEM\s+CURSO\b"
)
_ESTADO_SUCESSO = re.compile(
    r"\b(?:EXECUTAD|EFECTUAD|EFETUAD|CONFIRMAD|CONCLUID|REALIZAD|PROCESSAD|LIQUIDAD|ENVIAD|APROVAD)[AO]S?\b"
    r"|\bSUCESSO\b"
)


def extrair_estado(texto_normalizado: str) -> str | None:
    """`concluida`, `nao_concluida`, `em_processamento` ou None (não diz)."""
    if _ESTADO_FALHADO.search(texto_normalizado):
        return ESTADO_NAO_CONCLUIDA
    if _ESTADO_EM_PROCESSAMENTO.search(texto_normalizado):
        return ESTADO_EM_PROCESSAMENTO
    if _ESTADO_SUCESSO.search(texto_normalizado):
        return ESTADO_CONCLUIDA
    return None
