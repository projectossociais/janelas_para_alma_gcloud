"""CORS — o caminho normal é mesma-origem (o browser chama /api/*, o NGINX/Vite
reencaminha), mas o middleware continua a proteger pedidos cross-origin: só as
origens em `frontend_origins` passam, e só com credenciais."""

from fastapi.testclient import TestClient

from app.core.config import obter_settings
from app.main import app

client = TestClient(app)

ORIGEM_PERMITIDA = obter_settings().frontend_origins[0]


def test_preflight_de_origem_permitida_recebe_os_cabecalhos_cors() -> None:
    resposta = client.options(
        "/auth/entrar",
        headers={
            "Origin": ORIGEM_PERMITIDA,
            "Access-Control-Request-Method": "POST",
        },
    )
    assert resposta.headers.get("access-control-allow-origin") == ORIGEM_PERMITIDA
    assert resposta.headers.get("access-control-allow-credentials") == "true"


def test_preflight_de_origem_desconhecida_nao_recebe_allow_origin() -> None:
    resposta = client.options(
        "/auth/entrar",
        headers={
            "Origin": "https://site-malicioso.example",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert "access-control-allow-origin" not in resposta.headers


def test_metodo_fora_da_lista_nao_e_permitido_no_preflight() -> None:
    resposta = client.options(
        "/auth/entrar",
        headers={
            "Origin": ORIGEM_PERMITIDA,
            "Access-Control-Request-Method": "PUT",
        },
    )
    permitidos = resposta.headers.get("access-control-allow-methods", "")
    assert "PUT" not in permitidos
