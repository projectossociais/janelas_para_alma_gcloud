from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.core.dependencies import obter_auth_service
from app.main import app
from app.repositories.feedback_repository import FeedbackRegisto
from app.routers.feedback import obter_feedback_repository
from app.services.auth_service import AuthService
from tests.services.test_auth_service import RepositorioFalso


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
    with TestClient(app) as c:
        yield c, repo_feedback
    app.dependency_overrides.clear()


def test_regista_feedback_anonimo_sem_sessao(client) -> None:
    c, repo_feedback = client

    resposta = c.post("/feedback", json={"avaliacao": 5, "comentario": "Muito bom!"})

    assert resposta.status_code == 201
    assert repo_feedback.chamadas[0]["user_id"] is None


def test_regista_feedback_associado_a_quem_tem_sessao(client) -> None:
    c, repo_feedback = client
    c.post("/auth/registar", json={"email": "ana@example.com", "password": "password-forte-123"})

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
