"""Consentimento para dados de saúde (Lei 22/11, art. 13.º e 14.º): a API é a
fronteira -- sem consentimento, gravar um rastreio dá 403, mesmo que o pedido
não venha da interface (CLAUDE.md §4.1)."""

import pytest
from fastapi.testclient import TestClient

from app.core.dependencies import (
    obter_auth_service,
    obter_confirmacao_email_service,
    obter_conta_service,
)
from app.main import app
from app.routers.consentimento import (
    DETALHE_CONSENTIMENTO_EM_FALTA,
    obter_consentimento_saude_service,
)
from app.routers.screenings import obter_screenings_repository
from app.services.auth_service import AuthService
from app.services.confirmacao_email_service import ConfirmacaoEmailService
from app.services.consentimento_saude_service import VERSAO_ACTUAL
from app.services.conta_service import ContaService
from tests.routers.test_screenings_router import (
    PAYLOAD_VALIDO,
    RepositorioScreeningsFalso,
    _registar,
)
from tests.services.test_auth_service import RepositorioFalso
from tests.services.test_confirmacao_email_service import TokensConfirmacaoRepositorioFalso
from tests.services.test_consentimento_saude_service import servico
from tests.services.test_recuperacao_password_service import EmailSenderFalso


@pytest.fixture
def ambiente():
    repo_auth = RepositorioFalso()
    repo_screenings = RepositorioScreeningsFalso()
    consentimento = servico()
    app.dependency_overrides[obter_auth_service] = lambda: AuthService(repo_auth)
    app.dependency_overrides[obter_screenings_repository] = lambda: repo_screenings
    app.dependency_overrides[obter_consentimento_saude_service] = lambda: consentimento
    app.dependency_overrides[obter_conta_service] = lambda: ContaService(repo_auth)
    app.dependency_overrides[obter_confirmacao_email_service] = lambda: ConfirmacaoEmailService(
        repo_auth, TokensConfirmacaoRepositorioFalso(), EmailSenderFalso()
    )
    with TestClient(app) as c:
        c.repo_auth = repo_auth  # type: ignore[attr-defined]
        yield c, repo_screenings
    app.dependency_overrides.clear()


CONSENTIR = {"declara_maioridade": True, "aceita_tratamento": True, "representa_menor": True}


def test_sem_sessao_401(ambiente) -> None:
    c, _ = ambiente
    assert c.get("/consentimento-saude").status_code == 401
    assert c.post("/consentimento-saude", json=CONSENTIR).status_code == 401


def test_estado_inicial_sem_consentimento(ambiente) -> None:
    c, _ = ambiente
    _registar(c)
    r = c.get("/consentimento-saude")
    assert r.status_code == 200
    assert r.json()["consentido"] is False
    assert r.json()["versao_actual"] == VERSAO_ACTUAL


def test_gravar_rastreio_sem_consentimento_da_403_e_nao_grava(ambiente) -> None:
    c, repo = ambiente
    _registar(c)
    r = c.post("/screenings", json=PAYLOAD_VALIDO)
    assert r.status_code == 403
    assert r.json()["detail"] == DETALHE_CONSENTIMENTO_EM_FALTA
    assert repo.gravadas == []


def test_depois_de_consentir_o_rastreio_grava(ambiente) -> None:
    c, repo = ambiente
    _registar(c)
    r = c.post("/consentimento-saude", json=CONSENTIR)
    assert r.status_code == 200
    assert r.json()["consentido"] is True
    assert r.json()["representa_menor"] is True
    assert c.post("/screenings", json=PAYLOAD_VALIDO).status_code == 201
    assert len(repo.gravadas) == 1


@pytest.mark.parametrize(
    "corpo",
    [
        {"declara_maioridade": False, "aceita_tratamento": True},
        {"declara_maioridade": True, "aceita_tratamento": False},
    ],
)
def test_sem_as_duas_declaracoes_422_e_nada_muda(ambiente, corpo) -> None:
    c, _ = ambiente
    _registar(c)
    assert c.post("/consentimento-saude", json=corpo).status_code == 422
    assert c.get("/consentimento-saude").json()["consentido"] is False


def test_campos_a_mais_sao_recusados(ambiente) -> None:
    c, _ = ambiente
    _registar(c)
    r = c.post("/consentimento-saude", json={**CONSENTIR, "versao": "2020-01-01"})
    assert r.status_code == 422


def test_retirar_volta_a_bloquear_a_gravacao(ambiente) -> None:
    c, repo = ambiente
    _registar(c)
    c.post("/consentimento-saude", json=CONSENTIR)
    r = c.delete("/consentimento-saude")
    assert r.status_code == 200
    assert r.json()["consentido"] is False
    assert c.post("/screenings", json=PAYLOAD_VALIDO).status_code == 403
    assert repo.gravadas == []
