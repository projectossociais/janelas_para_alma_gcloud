from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.core.dependencies import (
    obter_auth_service,
    obter_confirmacao_email_service,
    obter_conta_service,
)
from app.main import app
from app.repositories.feedback_repository import FeedbackRegisto
from app.routers.feedback import obter_feedback_repository
from app.services.auth_service import AuthService
from app.services.confirmacao_email_service import ConfirmacaoEmailService
from app.services.conta_service import ContaService
from tests.services.test_auth_service import RepositorioFalso
from tests.services.test_confirmacao_email_service import TokensConfirmacaoRepositorioFalso
from tests.services.test_recuperacao_password_service import EmailSenderFalso


class RepositorioFeedbackFalso:
    def __init__(self) -> None:
        self.chamadas: list[dict] = []

    def criar(self, avaliacao: int, comentario: str | None, user_id: str | None) -> FeedbackRegisto:
        self.chamadas.append({"avaliacao": avaliacao, "comentario": comentario, "user_id": user_id})
        return FeedbackRegisto(
            id="feedback-1", avaliacao=avaliacao, comentario=comentario, user_id=user_id, created_at=datetime.now(UTC)
        )


@pytest.fixture
def client():
    repo_auth = RepositorioFalso()
    repo_feedback = RepositorioFeedbackFalso()
    app.dependency_overrides[obter_auth_service] = lambda: AuthService(repo_auth)
    app.dependency_overrides[obter_feedback_repository] = lambda: repo_feedback
    # /auth/entrar também chama o ContaService (cancelar eliminação
    # agendada) -- sem isto cairia no repositório real.
    app.dependency_overrides[obter_conta_service] = lambda: ContaService(repo_auth)
    # /auth/registar manda sempre um email de confirmação (AUTH-02) -- sem
    # este override, cairia no repositório/email real (Postgres inexistente
    # em testes).
    app.dependency_overrides[obter_confirmacao_email_service] = lambda: ConfirmacaoEmailService(
        repo_auth, TokensConfirmacaoRepositorioFalso(), EmailSenderFalso()
    )
    with TestClient(app) as c:
        c.repo_auth = repo_auth  # type: ignore[attr-defined]
        yield c, repo_feedback
    app.dependency_overrides.clear()


def test_regista_feedback_anonimo_sem_sessao(client) -> None:
    c, repo_feedback = client

    resposta = c.post("/feedback", json={"avaliacao": 5, "comentario": "Muito bom!"})

    assert resposta.status_code == 201
    assert repo_feedback.chamadas[0]["user_id"] is None


def test_regista_feedback_associado_a_quem_tem_sessao(client) -> None:
    c, repo_feedback = client
    # AUTH-02: registar já não inicia sessão -- confirma no repositório
    # falso e entra a seguir (o fluxo de token por email é testado à parte).
    resposta_registo = c.post("/auth/registar", json={"email": "ana@example.com", "password": "password-forte-123"})
    c.repo_auth.confirmar_email(resposta_registo.json()["id"])  # type: ignore[attr-defined]
    c.post("/auth/entrar", json={"email": "ana@example.com", "password": "password-forte-123"})

    resposta = c.post("/feedback", json={"avaliacao": 4})

    assert resposta.status_code == 201
    assert repo_feedback.chamadas[0]["user_id"] is not None


def test_rejeita_avaliacao_fora_do_intervalo(client) -> None:
    c, _ = client

    resposta = c.post("/feedback", json={"avaliacao": 6})

    assert resposta.status_code == 422


def test_comentario_e_opcional(client) -> None:
    c, repo_feedback = client

    resposta = c.post("/feedback", json={"avaliacao": 3})

    assert resposta.status_code == 201
    assert repo_feedback.chamadas[0]["comentario"] is None
