"""Equivalente, ao nível do router, ao teste-exemplo do CLAUDE.md secção 8:
"Submeter uma doação com o insert a falhar não mostra ecrã de sucesso." Aqui
isso significa: nunca 201 quando o repository falha.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers.doacoes import obter_doacao_service
from app.services.doacao_service import DoacaoService
from tests.services.test_doacao_service import (
    EmailSenderFalso,
    RepositorioFalso,
    RepositorioQueFalha,
)


@pytest.fixture
def client_ok():
    app.dependency_overrides[obter_doacao_service] = lambda: DoacaoService(RepositorioFalso(), EmailSenderFalso())
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def client_com_falha_de_gravacao():
    app.dependency_overrides[obter_doacao_service] = lambda: DoacaoService(
        RepositorioQueFalha(), EmailSenderFalso()
    )
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def client_com_falha_de_email():
    app.dependency_overrides[obter_doacao_service] = lambda: DoacaoService(
        RepositorioFalso(), EmailSenderFalso(falha=True)
    )
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


def test_regista_doacao_de_materiais(client_ok: TestClient) -> None:
    resposta = client_ok.post(
        "/doacoes/materiais", json={"email": "ana@example.com", "materiais": ["livros", "brinquedos"]}
    )

    assert resposta.status_code == 201
    corpo = resposta.json()
    assert corpo["recibo_id"].startswith("JPA-")
    assert corpo["status"] == "pendente"


def test_rejeita_sem_materiais(client_ok: TestClient) -> None:
    resposta = client_ok.post("/doacoes/materiais", json={"email": "ana@example.com", "materiais": []})

    assert resposta.status_code == 422


def test_nunca_devolve_201_quando_a_gravacao_falha(client_com_falha_de_gravacao: TestClient) -> None:
    resposta = client_com_falha_de_gravacao.post(
        "/doacoes/materiais", json={"email": "ana@example.com", "materiais": ["livros"]}
    )

    assert resposta.status_code != 201
    assert resposta.status_code == 500


def test_nunca_devolve_201_quando_o_envio_do_email_falha(client_com_falha_de_email: TestClient) -> None:
    resposta = client_com_falha_de_email.post(
        "/doacoes/materiais", json={"email": "ana@example.com", "materiais": ["livros"]}
    )

    assert resposta.status_code != 201
    assert resposta.status_code == 500


def test_regista_doacao_financeira_com_comprovativo_valido(client_ok: TestClient) -> None:
    resposta = client_ok.post(
        "/doacoes/financeiro",
        json={"email": "ana@example.com", "comprovativo_chave": "comprovativos/abc.pdf"},
    )

    assert resposta.status_code == 201
    corpo = resposta.json()
    assert corpo["recibo_id"].startswith("FIN-")
    assert corpo["status"] == "comprovativo_enviado"


def test_recusa_comprovativo_fora_do_prefixo_com_403(client_ok: TestClient) -> None:
    resposta = client_ok.post(
        "/doacoes/financeiro",
        json={"email": "ana@example.com", "comprovativo_chave": "avatares/outro/foto.png"},
    )

    assert resposta.status_code == 403
