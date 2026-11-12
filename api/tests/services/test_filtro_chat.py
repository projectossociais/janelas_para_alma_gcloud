import pytest

from app.services.filtro_chat import TAMANHO_MAXIMO, avaliar_mensagem


@pytest.mark.parametrize(
    "texto",
    [
        "Boa sorte!",
        "Essa era difícil, parabéns",
        "Quase! Faltou 1 segundo",
        "Tens cuidado com a pergunta 5",
        "A córnea fica à frente do olho",
        "Vou ganhar 3 a 2",
        "Jogamos outra vez?",
        "Good game, well played",
        "Que curiosidade interessante",
        "O computador é lento hoje",
        "Acertei 4 de 5, e tu?",
    ],
)
def test_conversa_normal_passa(texto) -> None:
    limpa, motivo = avaliar_mensagem(texto)
    assert motivo is None
    assert limpa == texto


def test_apara_espacos() -> None:
    assert avaliar_mensagem("  boa   jogada \n") == ("boa jogada", None)


@pytest.mark.parametrize("texto", ["", "   ", "\n\t"])
def test_mensagem_vazia_e_recusada(texto) -> None:
    assert avaliar_mensagem(texto)[1] == "vazia"


def test_mensagem_comprida_e_recusada() -> None:
    assert avaliar_mensagem("a" * TAMANHO_MAXIMO)[1] is None
    assert avaliar_mensagem("ab " * TAMANHO_MAXIMO)[1] == "comprida"


@pytest.mark.parametrize(
    "texto",
    [
        "és uma merda",
        "MERDA",
        "vai-te foder",
        "foda-se",
        "fooooda-se",
        "m3rd4",
        "p.u.t.a",
        "p u t a",
        "filho da puta",
        "seu burro",
        "és estúpido",
        "caralho!",
        "idiota",
        "fuck you",
        "sh1t",
        "you b!tch",
        "seu macaco",
        "vesgo",
        "manda nudes",
    ],
)
def test_palavroes_e_insultos_sao_recusados(texto) -> None:
    assert avaliar_mensagem(texto)[1] == "linguagem"


@pytest.mark.parametrize(
    "texto",
    [
        "o meu número é 923456789",
        "liga 9 2 3 4 5 6 7 8 9",
        "923-456-789",
        "nove dois três quatro cinco seis",
        "tenho whatsapp",
        "adiciona-me no insta",
        "procura no Facebook",
        "vai a www.exemplo.com",
        "https://exemplo.ao/jogo",
        "site exemplo.com",
        "ana@example.com",
        "ana arroba gmail",
        "segue @ana_luanda",
        "manda dm",
        "fala no privado",
    ],
)
def test_formas_de_contacto_sao_recusadas(texto) -> None:
    assert avaliar_mensagem(texto)[1] == "contacto"


@pytest.mark.parametrize(
    "texto",
    [
        "onde moras?",
        "qual é a tua morada",
        "em que escola andas",
        "que idade tens?",
        "quantos anos tens",
        "manda uma foto",
        "estás sozinha?",
        "é segredo nosso",
        "how old... what is your age",
        "send a pic",
    ],
)
def test_pedidos_de_dados_pessoais_sao_recusados(texto) -> None:
    assert avaliar_mensagem(texto)[1] == "dados_pessoais"
