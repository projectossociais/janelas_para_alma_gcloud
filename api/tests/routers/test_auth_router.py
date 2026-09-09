"""Testes de integração do router de autenticação — TestClient de verdade,
sem base de dados real (o repositório falso é injectado via dependency
override). O que importa testar aqui é especificamente o que o teste
unitário do service não cobre: os cookies `httpOnly` e a dependency que
protege rotas — ver CLAUDE.md, "routers testam-se com TestClient, incluindo
os códigos de erro".
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers import auth as auth_router
from app.services.auth_service import AuthService
from tests.services.test_auth_service import RepositorioFalso


@pytest.fixture
def client():
    repo = RepositorioFalso()
    app.dependency_overrides[auth_router.obter_auth_service] = lambda: AuthService(repo)
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_registar_devolve_201_e_cookies_httponly(client: TestClient) -> None:
    resposta = client.post("/auth/registar", json={"email": "ana@example.com", "password": "password-forte-123"})

    assert resposta.status_code == 201
    assert resposta.json()["email"] == "ana@example.com"
    assert "access_token" in resposta.cookies
    assert "refresh_token" in resposta.cookies
    # httpOnly não aparece em resposta.cookies (é um jar de valores) — a
    # única forma de confirmar é ler o header Set-Cookie em bruto.
    set_cookie = resposta.headers.get_list("set-cookie")
    assert any("httponly" in c.lower() and "access_token" in c for c in set_cookie)
    assert any("httponly" in c.lower() and "refresh_token" in c for c in set_cookie)


def test_registar_recolhe_os_dados_de_perfil_do_formulario(client: TestClient) -> None:
    resposta = client.post(
        "/auth/registar",
        json={
            "email": "ana@example.com",
            "password": "password-forte-123",
            "nome": "Ana Teste",
            "provincia": "Luanda",
            "genero": "feminino",
            "papel": "estrabico",
        },
    )

    assert resposta.status_code == 201
    corpo = resposta.json()
    assert corpo["nome"] == "Ana Teste"
    assert corpo["provincia"] == "Luanda"
    assert corpo["papel"] == "estrabico"


def test_registar_recusa_um_papel_nao_auto_registavel(client: TestClient) -> None:
    # O utilizador podia mentir sobre isto — enviar "admin" directamente à
    # API, sem passar pelo <Select> do formulário. A validação tem de viver
    # aqui, não só na interface.
    resposta = client.post(
        "/auth/registar", json={"email": "ana@example.com", "password": "password-forte-123", "papel": "admin"}
    )

    assert resposta.status_code == 422
    assert client.get("/auth/eu").status_code == 401  # nenhuma conta foi criada


def test_registar_com_email_duplicado_devolve_409(client: TestClient) -> None:
    client.post("/auth/registar", json={"email": "ana@example.com", "password": "password-forte-123"})

    resposta = client.post("/auth/registar", json={"email": "ana@example.com", "password": "outra-123456"})

    assert resposta.status_code == 409


def test_entrar_com_credenciais_certas_permite_aceder_a_eu(client: TestClient) -> None:
    client.post("/auth/registar", json={"email": "ana@example.com", "password": "password-forte-123"})

    resposta_entrar = client.post("/auth/entrar", json={"email": "ana@example.com", "password": "password-forte-123"})
    assert resposta_entrar.status_code == 200

    resposta_eu = client.get("/auth/eu")
    assert resposta_eu.status_code == 200
    assert resposta_eu.json()["email"] == "ana@example.com"


def test_entrar_com_password_errada_devolve_401_e_nao_define_cookies(client: TestClient) -> None:
    client.post("/auth/registar", json={"email": "ana@example.com", "password": "password-forte-123"})
    client.cookies.clear()  # esquecer a sessão criada pelo registo — não é o que este teste cobre

    resposta = client.post("/auth/entrar", json={"email": "ana@example.com", "password": "errada"})

    assert resposta.status_code == 401
    assert "access_token" not in resposta.cookies
    assert "refresh_token" not in resposta.cookies
    # Sem cookies novos definidos, um pedido a seguir também não está autenticado.
    assert client.get("/auth/eu").status_code == 401


def test_eu_sem_cookie_nenhum_devolve_401(client: TestClient) -> None:
    resposta = client.get("/auth/eu")

    assert resposta.status_code == 401


def test_sair_limpa_a_sessao(client: TestClient) -> None:
    client.post("/auth/registar", json={"email": "ana@example.com", "password": "password-forte-123"})
    assert client.get("/auth/eu").status_code == 200

    resposta_sair = client.post("/auth/sair")
    assert resposta_sair.status_code == 204

    assert client.get("/auth/eu").status_code == 401


def test_atualizar_token_sem_refresh_cookie_devolve_401(client: TestClient) -> None:
    resposta = client.post("/auth/atualizar-token")

    assert resposta.status_code == 401


def test_atualizar_token_renova_o_acesso_sem_precisar_de_reautenticar(client: TestClient) -> None:
    client.post("/auth/registar", json={"email": "ana@example.com", "password": "password-forte-123"})

    # Um novo access_token é emitido — mesmo sem o refresh_token mudar de
    # mãos, a chamada seguinte a /eu continua a funcionar.
    resposta = client.post("/auth/atualizar-token")
    assert resposta.status_code == 204
    assert "access_token" in resposta.cookies

    assert client.get("/auth/eu").status_code == 200
