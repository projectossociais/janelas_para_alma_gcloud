"""Filtro de segurança do chat do Multijogador Online.

O chat só existe entre dois adultos (ver `sala_jogo_service.e_adulto`), mas
o produto é uma plataforma de saúde visual com público infantil: uma criança
pode estar ao lado de quem joga. Por isso uma mensagem é **recusada** (nunca
"limpa" e enviada) quando tem:

- palavrões ou insultos, em português ou inglês, mesmo disfarçados
  ("p.u.t.a", "m3rda", "fooooda-se");
- formas de contacto ou de levar a conversa para fora daqui: links, emails,
  números de telefone (também por extenso em algarismos espaçados), @nomes e
  nomes de redes sociais ou aplicações de mensagens;
- pedidos de dados pessoais (morada, escola, idade, fotografias).

Lógica pura, sem base de dados. É uma rede de segurança, não uma garantia:
quem quiser contornar um filtro de palavras acaba por conseguir -- por isso
existem também a denúncia (fecha o chat da sala) e o limite de mensagens.
"""

import re
import unicodedata
from typing import Literal

TAMANHO_MAXIMO = 200

MotivoRecusa = Literal["vazia", "comprida", "linguagem", "contacto", "dados_pessoais"]

# Radicais: apanham também plurais e derivados ("merdas", "fodido").
_PALAVROES = (
    # português
    "merd", "fod", "foda", "put", "caralh", "cabra", "cabrao", "cona", "conas", "pila", "piça", "pica",
    "porra", "bosta", "cu", "cuzao", "paneleir", "panilas", "maricas", "viad", "bicha", "corn", "vadia",
    "puta", "otari", "idiota", "imbecil", "estupid", "burr", "matumb", "cabao", "filhadaputa", "fdp",
    "sacana", "punheta", "broche", "mamada", "tesao", "rata", "pito", "xoxota", "buceta", "pau",
    "pret", "macac", "gord", "aleijad", "retardad", "mongoloid", "zarolh", "vesg",
    # inglês
    "fuck", "shit", "bitch", "asshole", "bastard", "dick", "cock", "pussy", "cunt", "whore", "slut",
    "nigg", "fag", "retard", "wank", "porn", "sex", "nude", "rape",
)
# Palavras inocentes que começam por um radical acima.
_INOCENTES = frozenset(
    {
        "cuidado", "cuidar", "cuidados", "curso", "curto", "curta", "cura", "curar", "curioso", "curiosa",
        "curiosidade", "curiosidades", "culpa", "cultura", "cubo", "custo", "custa", "cumprimentos", "cujo",
        "pausa", "pauta", "paulo", "paula", "pico", "picar", "picante", "pitoresco", "ratazana",
        "preto", "preta", "pretos", "pretas", "pretende", "pretendo", "pretexto", "preterito",
        "gordura", "gorduras", "corneta", "cornea", "corneas", "burro", "burra",
        "foda",  # tratado abaixo como palavrão exacto; aqui só evita o duplicado
        "putativo", "computador", "sexta", "sexto", "sexo", "dicka",
        "bichano", "viaduto", "viado", "macaco", "macaca", "macacos", "vesgo", "vesga", "zarolho",
        "pau", "pica", "pito", "rata", "cabra", "pila",
    }
)
# ...mas estas, mesmo sendo palavras do dicionário, não se dizem a outro jogador.
_EXACTAS = frozenset(
    {"foda", "burro", "burra", "viado", "macaco", "macaca", "vesgo", "vesga", "zarolho", "sexo", "cu", "pau"}
)

_CONTACTO = (
    "whatsapp", "whats", "wpp", "zap", "telegram", "instagram", "insta", "facebook", "face", "messenger",
    "tiktok", "snapchat", "snap", "discord", "skype", "viber", "signal", "imo", "gmail", "hotmail", "outlook",
    "yahoo", "email", "mail", "telefone", "telemovel", "celular", "numero", "contacto", "contato", "liga",
    "ligame", "adicioname", "segueme", "dm", "pv", "privado", "inbox",
)
_DADOS_PESSOAIS = (
    "morada", "endereco", "moras", "mora", "vives", "bairro", "rua", "escola", "colegio", "idade", "anos",
    "foto", "fotos", "fotografia", "selfie", "video", "camara", "sozinho", "sozinha", "pais", "segredo",
    "address", "school", "age", "photo", "picture", "pic", "alone", "secret",
)

_LEET = str.maketrans({"0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "@": "a", "$": "s", "!": "i"})
_LINK = re.compile(r"(https?://|www\.|\b[a-z0-9-]+\.(com|net|org|ao|pt|br|io|me|app|co|info|xyz|gg|ly|tv)\b)", re.IGNORECASE)
_EMAIL = re.compile(r"[\w.+-]+\s*(@|\(at\)|\[at\]|\barroba\b)\s*[\w-]+", re.IGNORECASE)
_ARROBA = re.compile(r"(^|\s)@\w+")
_NUMERAIS = (
    "zero", "um", "uma", "dois", "duas", "tres", "quatro", "cinco", "seis", "sete", "oito", "nove",
    "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
)


def _sem_acentos(texto: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", texto) if unicodedata.category(c) != "Mn")


def _palavras(texto: str) -> list[str]:
    """Palavras em minúsculas, sem acentos, com letras repetidas reduzidas
    ("fooooda" -> "foda") e os disfarces mais comuns desfeitos ("m3rd4")."""
    base = _sem_acentos(texto.lower())
    # Só desfaz o "leet" dentro de palavras com letras: um número sozinho é só um número.
    tokens = re.findall(r"[a-z0-9@$!]+", base)
    palavras = []
    for token in tokens:
        if re.search(r"[a-z]", token):
            token = token.translate(_LEET)
        token = re.sub(r"[^a-z0-9]", "", token)
        token = re.sub(r"([a-z])\1{2,}", r"\1", token)
        if token:
            palavras.append(token)
    return palavras


def _e_palavrao(palavra: str) -> bool:
    if palavra in _EXACTAS:
        return True
    if palavra in _INOCENTES:
        return False
    sem_dobras = re.sub(r"([a-z])\1+", r"\1", palavra)
    return any(p.startswith(radical) for p in {palavra, sem_dobras} for radical in _PALAVROES if len(radical) > 2) or (
        sem_dobras in {"cu", "fdp"}
    )


def _tem_palavrao(palavras: list[str]) -> bool:
    if any(_e_palavrao(p) for p in palavras):
        return True
    # Letras soltas a soletrar um palavrão: "p u t a", "m.e.r.d.a".
    soletrado = ""
    for palavra in [*palavras, "--"]:
        if len(palavra) == 1 and palavra.isalpha():
            soletrado += palavra
            continue
        if len(soletrado) >= 3 and (_e_palavrao(soletrado) or soletrado in _INOCENTES & _EXACTAS):
            return True
        soletrado = ""
    return False


def _tem_contacto(texto: str, palavras: list[str]) -> bool:
    if _LINK.search(texto) or _EMAIL.search(texto) or _ARROBA.search(texto):
        return True
    if any(p in _CONTACTO for p in palavras):
        return True
    # Um número de telefone: 7 ou mais algarismos na mensagem, juntos ou
    # espalhados ("9 2 3 ...", "923-456-789"), ou escritos por extenso.
    algarismos = sum(c.isdigit() for c in texto)
    por_extenso = sum(1 for p in palavras if p in _NUMERAIS)
    return algarismos >= 7 or por_extenso >= 5 or algarismos + por_extenso >= 7


def avaliar_mensagem(texto: str) -> tuple[str, MotivoRecusa | None]:
    """Devolve a mensagem limpa de espaços e o motivo da recusa (`None` =
    pode ser enviada)."""
    limpa = re.sub(r"\s+", " ", texto).strip()
    if not limpa:
        return limpa, "vazia"
    if len(limpa) > TAMANHO_MAXIMO:
        return limpa, "comprida"
    palavras = _palavras(limpa)
    if _tem_palavrao(palavras):
        return limpa, "linguagem"
    if _tem_contacto(limpa, palavras):
        return limpa, "contacto"
    if any(p in _DADOS_PESSOAIS for p in palavras):
        return limpa, "dados_pessoais"
    return limpa, None
