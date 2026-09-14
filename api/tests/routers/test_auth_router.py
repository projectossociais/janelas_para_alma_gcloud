"""Testes de integração do router de autenticação — TestClient de verdade,
sem base de dados real (o repositório falso é injectado via dependency
override). O que importa testar aqui é especificamente o que o teste
unitário do service não cobre: os cookies `httpOnly` e a dependency que
protege rotas — ver CLAUDE.md, "routers testam-se com TestClient, incluindo
os códigos de erro".
"""

import pytest
from fastapi.testclient import TestClient

from app.core.dependencies import (
    obter_confirmacao_email_service,
    obter_conta_service,
    obter_recuperacao_password_service,
)
from app.main import app
from app.routers import auth as auth_router
from app.services.auth_service import AuthService
from app.services.confirmacao_email_service import ConfirmacaoEmailService
from app.services.conta_service import ContaService
from app.services.recuperacao_password_service import RecuperacaoPasswordService
from tests.services.test_auth_service import RepositorioFalso
from tests.services.test_confirmacao_email_service import TokensConfirmacaoRepositorioFalso
from tests.services.test_recuperacao_password_service import (
    EmailSenderFalso,
    TokensRepositorioFalso,
)


@pytest.fixture
def client():
    repo = RepositorioFalso()
    tokens_repo = TokensRepositorioFalso()
    tokens_confirmacao_repo = TokensConfirmacaoRepositorioFalso()
    # Mesma instância partilhada pelos dois serviços -- client.email_sender
    # acumula tanto emails de recuperação de password como de confirmação
    # de conta, distinguíveis pelo link (/redefinir-password vs /confirmar-email).
    email_sender = EmailSenderFalso()
    app.dependency_overrides[auth_router.obter_auth_service] = lambda: AuthService(repo)
    # entrar() também chama o ContaService (para cancelar uma eliminação
    # agendada) -- sem isto cairia no repositório real (Postgres inexistente
    # em testes).
    app.dependency_overrides[obter_conta_service] = lambda: ContaService(repo)
    # Mesma instância de tokens_repo/email_sender entre pedidos (fecho sobre
    # a variável, não uma nova a cada chamada) -- um teste que solicita a
    # recuperação numa chamada e redefine noutra precisa de ver o mesmo token.
    app.dependency_overrides[obter_recuperacao_password_service] = lambda: RecuperacaoPasswordService(
        repo, tokens_repo, email_sender
    )
    app.dependency_overrides[obter_confirmacao_email_service] = lambda: ConfirmacaoEmailService(
        repo, tokens_confirmacao_repo, email_sender
    )
    with TestClient(app) as c:
        c.email_sender = email_sender  # type: ignore[attr-defined]
        yield c
    app.dependency_overrides.clear()


def _confirmar_ultimo_registo(client: TestClient) -> None:
    """O registo já manda sempre um email de confirmação (AUTH-02) -- este
    helper simula o utilizador a clicar no link, para testes que não são
    sobre a confirmação em si, só precisam de uma conta já activa."""
    corpo_html = client.email_sender.enviados[-1]["corpo_html"]  # type: ignore[attr-defined]
    token = corpo_html.split("token=")[1].split('"')[0]
    resposta = client.post("/auth/confirmar-email", json={"token": token})
    assert resposta.status_code == 204


def test_registar_devolve_201_sem_cookies_e_envia_email_de_confirmacao(client: TestClient) -> None:
    # AUTH-02: registar já não inicia sessão -- nenhum cookie é definido, e
    # a conta fica por confirmar até o link do email ser seguido.
    resposta = client.post("/auth/registar", json={"email": "ana@example.com", "password": "password-forte-123"})

    assert resposta.status_code == 201
    corpo = resposta.json()
    assert corpo["email"] == "ana@example.com"
    assert corpo["email_confirmado"] is False
    assert "access_token" not in resposta.cookies
    assert "refresh_token" not in resposta.cookies
    assert client.get("/auth/eu").status_code == 401

    assert len(client.email_sender.enviados) == 1  # type: ignore[attr-defined]
    assert "/confirmar-email?token=" in client.email_sender.enviados[0]["corpo_html"]  # type: ignore[attr-defined]


def test_registar_recolhe_os_dados_de_perfil_do_formulario(client: TestClient) -> None:
    resposta = client.post(
        "/auth/registar",
        json={
            "email": "ana@example.com",
            "password": "password-forte-123",
            "nome_completo": "Ana Teste",
            "provincia": "Luanda",
            "genero": "feminino",
            "papel": "estrabico",
        },
    )

    assert resposta.status_code == 201
    corpo = resposta.json()
    assert corpo["nome_completo"] == "Ana Teste"
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
    _confirmar_ultimo_registo(client)

    resposta_entrar = client.post("/auth/entrar", json={"email": "ana@example.com", "password": "password-forte-123"})
    assert resposta_entrar.status_code == 200

    resposta_eu = client.get("/auth/eu")
    assert resposta_eu.status_code == 200
    assert resposta_eu.json()["email"] == "ana@example.com"


def test_entrar_sem_confirmar_o_email_devolve_403_e_nao_define_cookies(client: TestClient) -> None:
    # AUTH-02, bloqueio total: password certa não chega sem confirmar.
    client.post("/auth/registar", json={"email": "ana@example.com", "password": "password-forte-123"})

    resposta = client.post("/auth/entrar", json={"email": "ana@example.com", "password": "password-forte-123"})

    assert resposta.status_code == 403
    assert "access_token" not in resposta.cookies
    assert client.get("/auth/eu").status_code == 401


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
    _confirmar_ultimo_registo(client)
    client.post("/auth/entrar", json={"email": "ana@example.com", "password": "password-forte-123"})
    assert client.get("/auth/eu").status_code == 200

    resposta_sair = client.post("/auth/sair")
    assert resposta_sair.status_code == 204

    assert client.get("/auth/eu").status_code == 401


def test_atualizar_token_sem_refresh_cookie_devolve_401(client: TestClient) -> None:
    resposta = client.post("/auth/atualizar-token")

    assert resposta.status_code == 401


def test_atualizar_token_renova_o_acesso_sem_precisar_de_reautenticar(client: TestClient) -> None:
    client.post("/auth/registar", json={"email": "ana@example.com", "password": "password-forte-123"})
    _confirmar_ultimo_registo(client)
    client.post("/auth/entrar", json={"email": "ana@example.com", "password": "password-forte-123"})

    # Um novo access_token é emitido — mesmo sem o refresh_token mudar de
    # mãos, a chamada seguinte a /eu continua a funcionar.
    resposta = client.post("/auth/atualizar-token")
    assert resposta.status_code == 204
    assert "access_token" in resposta.cookies

    assert client.get("/auth/eu").status_code == 200


def _extrair_token_do_email(client: TestClient) -> str:
    corpo_html = client.email_sender.enviados[-1]["corpo_html"]  # type: ignore[attr-defined]
    return corpo_html.split("token=")[1].split('"')[0]


def test_recuperar_password_devolve_202_com_ou_sem_conta(client: TestClient) -> None:
    # A resposta é idêntica nos dois casos de propósito — nunca confirmar a
    # um atacante se um email está registado.
    client.post("/auth/registar", json={"email": "ana@example.com", "password": "password-forte-123"})
    client.cookies.clear()

    resposta_com_conta = client.post("/auth/recuperar-password", json={"email": "ana@example.com"})
    resposta_sem_conta = client.post("/auth/recuperar-password", json={"email": "ninguem@example.com"})

    assert resposta_com_conta.status_code == 202
    assert resposta_sem_conta.status_code == 202
    assert resposta_com_conta.json() == resposta_sem_conta.json()
    # 2, não 1: o registo já manda o email de confirmação (AUTH-02); só o
    # segundo é o de recuperação de password propriamente dito.
    assert len(client.email_sender.enviados) == 2  # type: ignore[attr-defined]


def test_fluxo_completo_recuperar_e_redefinir_password(client: TestClient) -> None:
    client.post("/auth/registar", json={"email": "ana@example.com", "password": "password-forte-123"})
    _confirmar_ultimo_registo(client)
    client.cookies.clear()

    client.post("/auth/recuperar-password", json={"email": "ana@example.com"})
    token = _extrair_token_do_email(client)

    resposta_redefinir = client.post(
        "/auth/redefinir-password", json={"token": token, "password_nova": "password-nova-456"}
    )
    assert resposta_redefinir.status_code == 204

    # A password antiga deixou de funcionar, a nova sim.
    assert client.post("/auth/entrar", json={"email": "ana@example.com", "password": "password-forte-123"}).status_code == 401
    resposta_entrar = client.post("/auth/entrar", json={"email": "ana@example.com", "password": "password-nova-456"})
    assert resposta_entrar.status_code == 200


def test_redefinir_password_com_token_invalido_devolve_400_e_nao_muda_nada(client: TestClient) -> None:
    client.post("/auth/registar", json={"email": "ana@example.com", "password": "password-forte-123"})
    _confirmar_ultimo_registo(client)
    client.cookies.clear()

    resposta = client.post(
        "/auth/redefinir-password", json={"token": "token-forjado", "password_nova": "password-nova-456"}
    )

    assert resposta.status_code == 400
    # A password original continua a funcionar -- a tentativa falhada não mudou nada.
    assert client.post("/auth/entrar", json={"email": "ana@example.com", "password": "password-forte-123"}).status_code == 200


def test_redefinir_password_com_token_ja_usado_devolve_400(client: TestClient) -> None:
    client.post("/auth/registar", json={"email": "ana@example.com", "password": "password-forte-123"})
    client.cookies.clear()
    client.post("/auth/recuperar-password", json={"email": "ana@example.com"})
    token = _extrair_token_do_email(client)
    client.post("/auth/redefinir-password", json={"token": token, "password_nova": "password-nova-456"})

    resposta_reuso = client.post(
        "/auth/redefinir-password", json={"token": token, "password_nova": "outra-password-789"}
    )

    assert resposta_reuso.status_code == 400


def test_redefinir_password_recusa_password_fraca(client: TestClient) -> None:
    client.post("/auth/registar", json={"email": "ana@example.com", "password": "password-forte-123"})
    client.cookies.clear()
    client.post("/auth/recuperar-password", json={"email": "ana@example.com"})
    token = _extrair_token_do_email(client)

    resposta = client.post("/auth/redefinir-password", json={"token": token, "password_nova": "curta"})

    assert resposta.status_code == 422


def test_confirmar_email_com_token_valido_permite_entrar_depois(client: TestClient) -> None:
    client.post("/auth/registar", json={"email": "ana@example.com", "password": "password-forte-123"})
    token = client.email_sender.enviados[-1]["corpo_html"].split("token=")[1].split('"')[0]  # type: ignore[attr-defined]

    resposta_confirmar = client.post("/auth/confirmar-email", json={"token": token})
    assert resposta_confirmar.status_code == 204

    resposta_entrar = client.post("/auth/entrar", json={"email": "ana@example.com", "password": "password-forte-123"})
    assert resposta_entrar.status_code == 200


def test_confirmar_email_com_token_invalido_devolve_400(client: TestClient) -> None:
    client.post("/auth/registar", json={"email": "ana@example.com", "password": "password-forte-123"})

    resposta = client.post("/auth/confirmar-email", json={"token": "token-forjado"})

    assert resposta.status_code == 400
    # Continua por confirmar -- a tentativa falhada não mudou nada.
    assert (
        client.post(
            "/auth/entrar", json={"email": "ana@example.com", "password": "password-forte-123"}
        ).status_code
        == 403
    )


def test_confirmar_email_com_token_ja_usado_devolve_400(client: TestClient) -> None:
    client.post("/auth/registar", json={"email": "ana@example.com", "password": "password-forte-123"})
    _confirmar_ultimo_registo(client)

    token = client.email_sender.enviados[-1]["corpo_html"].split("token=")[1].split('"')[0]  # type: ignore[attr-defined]
    resposta_reuso = client.post("/auth/confirmar-email", json={"token": token})

    assert resposta_reuso.status_code == 400


def test_reenviar_confirmacao_devolve_202_com_ou_sem_conta_por_confirmar(client: TestClient) -> None:
    client.post("/auth/registar", json={"email": "ana@example.com", "password": "password-forte-123"})

    resposta_com_conta = client.post("/auth/reenviar-confirmacao", json={"email": "ana@example.com"})
    resposta_sem_conta = client.post("/auth/reenviar-confirmacao", json={"email": "ninguem@example.com"})

    assert resposta_com_conta.status_code == 202
    assert resposta_sem_conta.status_code == 202
    assert resposta_com_conta.json() == resposta_sem_conta.json()
    # 2: o do registo + o do reenvio explícito -- só o pedido com conta gera um novo.
    assert len(client.email_sender.enviados) == 2  # type: ignore[attr-defined]


def test_reenviar_confirmacao_de_conta_ja_confirmada_nao_manda_outro_email(client: TestClient) -> None:
    client.post("/auth/registar", json={"email": "ana@example.com", "password": "password-forte-123"})
    _confirmar_ultimo_registo(client)

    resposta = client.post("/auth/reenviar-confirmacao", json={"email": "ana@example.com"})

    assert resposta.status_code == 202
    # Só o email original do registo -- reenviar não gerou um segundo.
    assert len(client.email_sender.enviados) == 1  # type: ignore[attr-defined]
