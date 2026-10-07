import json

import pytest
from fastapi.testclient import TestClient

from app.core.dependencies import (
    obter_auth_service,
    obter_confirmacao_email_service,
    obter_conta_service,
)
from app.main import app
from app.routers.consentimento import obter_consentimento_saude_service
from app.routers.rastreio_completo import obter_rastreio_completo_service
from app.services.auth_service import AuthService
from app.services.confirmacao_email_service import ConfirmacaoEmailService
from app.services.consentimento_saude_service import ConsentimentoSaudeService
from app.services.conta_service import ContaService
from app.services.rastreio_completo_service import RastreioCompletoService
from tests.routers.test_screenings_router import RepositorioScreeningsFalso
from tests.services.test_auth_service import RepositorioFalso
from tests.services.test_confirmacao_email_service import TokensConfirmacaoRepositorioFalso
from tests.services.test_consentimento_saude_service import (
    RepositorioConsentimentoFalso,
    ServicoQueConsenteTodos,
)
from tests.services.test_recuperacao_password_service import EmailSenderFalso

MEDICOES = {
    "horizontal_delta": 9.0,
    "vertical_delta": 0.5,
    "dispersao_delta": 0.8,
    "fotografias_validas": 4,
    "fotografias_total": 5,
    "versao_motor": "motor-teste",
}


@pytest.fixture
def ambiente():
    repo_auth = RepositorioFalso()
    repo_screenings = RepositorioScreeningsFalso()
    app.dependency_overrides[obter_auth_service] = lambda: AuthService(repo_auth)
    app.dependency_overrides[obter_rastreio_completo_service] = lambda: RastreioCompletoService(
        repo_screenings
    )
    app.dependency_overrides[obter_consentimento_saude_service] = ServicoQueConsenteTodos
    app.dependency_overrides[obter_conta_service] = lambda: ContaService(repo_auth)
    app.dependency_overrides[obter_confirmacao_email_service] = lambda: ConfirmacaoEmailService(
        repo_auth, TokensConfirmacaoRepositorioFalso(), EmailSenderFalso()
    )
    with TestClient(app) as c:
        c.repo_auth = repo_auth  # type: ignore[attr-defined]
        yield c, repo_screenings
    app.dependency_overrides.clear()


def _entrar(c: TestClient) -> str:
    r = c.post("/auth/registar", json={"email": "ana@example.com", "password": "password-forte-123"})
    utilizador_id = r.json()["id"]
    c.repo_auth.confirmar_email(utilizador_id)  # type: ignore[attr-defined]
    c.post("/auth/entrar", json={"email": "ana@example.com", "password": "password-forte-123"})
    return utilizador_id


def test_convidado_recebe_resultado_sem_gravar(ambiente) -> None:
    c, repo = ambiente
    r = c.post("/rastreio-completo", json=MEDICOES)
    assert r.status_code == 200
    corpo = r.json()
    assert corpo["conclusao"] == "encaminhar"
    assert corpo["motivo"] == "desvio-horizontal"
    assert corpo["screening_id"] is None
    assert repo.gravadas == []


def test_com_sessao_grava_com_o_utilizador_do_jwt(ambiente) -> None:
    c, repo = ambiente
    uid = _entrar(c)
    r = c.post("/rastreio-completo", json={**MEDICOES, "user_id": "outro"})
    assert r.status_code == 200
    assert r.json()["screening_id"] == "screening-1"
    assert repo.gravadas[0]["user_id"] == uid


def test_sem_consentimento_responde_mas_nao_grava(ambiente) -> None:
    c, repo = ambiente
    app.dependency_overrides[obter_consentimento_saude_service] = lambda: ConsentimentoSaudeService(
        RepositorioConsentimentoFalso()
    )
    _entrar(c)
    r = c.post("/rastreio-completo", json=MEDICOES)
    assert r.status_code == 200
    assert r.json()["conclusao"] == "encaminhar"
    assert r.json()["screening_id"] is None
    assert repo.gravadas == []


def test_nao_mediu_grava_inconclusivo(ambiente) -> None:
    c, repo = ambiente
    _entrar(c)
    r = c.post("/rastreio-completo", json={**MEDICOES, "fotografias_validas": 1})
    assert r.json()["conclusao"] == "nao_mediu"
    assert r.json()["screening_id"] == "screening-1"
    assert repo.gravadas[0]["diagnostico"] == "inconclusivo"


@pytest.mark.parametrize(
    "mudanca",
    [
        {"horizontal_delta": float("nan")},
        {"horizontal_delta": 5000},
        {"dispersao_delta": -1},
        {"fotografias_validas": 99},
        {"versao_motor": ""},
    ],
)
def test_entrada_invalida_422(ambiente, mudanca) -> None:
    c, _ = ambiente
    # NaN não é JSON válido: envia-se como texto cru para o testar de verdade.
    r = c.post(
        "/rastreio-completo",
        content=json.dumps({**MEDICOES, **mudanca}, allow_nan=True),
        headers={"content-type": "application/json"},
    )
    assert r.status_code == 422


def test_aceita_so_medicoes_nunca_imagem(ambiente) -> None:
    c, repo = ambiente
    _entrar(c)
    c.post("/rastreio-completo", json={**MEDICOES, "imagem": "data:image/jpeg;base64,AAAA"})
    assert "imagem" not in str(repo.gravadas)
