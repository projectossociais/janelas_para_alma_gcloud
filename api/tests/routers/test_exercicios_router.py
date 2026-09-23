"""`/exercicios/*` — estado de acesso, início do trial e vídeo assinado.
Inclui os caminhos de erro (401, 403, 404, 409, 503)."""

from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.core.dependencies import (
    obter_auth_service,
    obter_confirmacao_email_service,
    obter_conta_service,
)
from app.main import app
from app.routers.exercicios import obter_acesso_exercicios_service, obter_presigner_videos
from app.services.acesso_exercicios_service import AcessoExerciciosService
from app.services.auth_service import AuthService
from app.services.confirmacao_email_service import ConfirmacaoEmailService
from app.services.conta_service import ContaService
from tests.services.test_acesso_exercicios_service import (
    PresignerFalso,
    RepositorioAcessoFalso,
    _conta,
)
from tests.services.test_auth_service import RepositorioFalso
from tests.services.test_confirmacao_email_service import TokensConfirmacaoRepositorioFalso
from tests.services.test_recuperacao_password_service import EmailSenderFalso


@pytest.fixture
def ambiente():
    repo_auth = RepositorioFalso()
    repo_acesso = RepositorioAcessoFalso(_conta())
    presigner = PresignerFalso()
    app.dependency_overrides[obter_auth_service] = lambda: AuthService(repo_auth)
    app.dependency_overrides[obter_conta_service] = lambda: ContaService(repo_auth)
    app.dependency_overrides[obter_confirmacao_email_service] = lambda: ConfirmacaoEmailService(
        repo_auth, TokensConfirmacaoRepositorioFalso(), EmailSenderFalso()
    )
    app.dependency_overrides[obter_acesso_exercicios_service] = lambda: AcessoExerciciosService(
        repo_acesso
    )
    app.dependency_overrides[obter_presigner_videos] = lambda: presigner
    with TestClient(app) as c:
        c.repo_auth = repo_auth  # type: ignore[attr-defined]
        yield c, repo_acesso, presigner
    app.dependency_overrides.clear()


def _entrar(c: TestClient) -> None:
    r = c.post("/auth/registar", json={"email": "ana@example.com", "password": "password-forte-123"})
    c.repo_auth.confirmar_email(r.json()["id"])  # type: ignore[attr-defined]
    c.post("/auth/entrar", json={"email": "ana@example.com", "password": "password-forte-123"})


def test_visitante_ve_estado_sem_sessao_e_nada_desbloqueado(ambiente) -> None:
    c, _, _ = ambiente
    corpo = c.get("/exercicios/acesso").json()
    assert corpo["estado"] == "sem_sessao"
    assert corpo["exercicios_desbloqueados"] == []
    assert len(corpo["exercicios_trial"]) == 4
    assert len(corpo["exercicios_premium"]) == 4


def test_conta_nova_tem_trial_disponivel(ambiente) -> None:
    c, _, _ = ambiente
    _entrar(c)
    assert c.get("/exercicios/acesso").json()["estado"] == "trial_disponivel"


def test_iniciar_trial_exige_sessao(ambiente) -> None:
    c, repo, _ = ambiente
    assert c.post("/exercicios/trial").status_code == 401
    assert repo.chamadas_iniciar == 0


def test_iniciar_trial_uma_vez_e_depois_409(ambiente) -> None:
    c, _, _ = ambiente
    _entrar(c)
    primeira = c.post("/exercicios/trial")
    assert primeira.status_code == 200
    assert primeira.json()["estado"] == "trial_ativo"
    assert primeira.json()["trial_dias_restantes"] == 7
    assert sorted(primeira.json()["exercicios_desbloqueados"]) == sorted(
        ["figure8", "convergence", "cerebro", "relax"]
    )
    assert c.post("/exercicios/trial").status_code == 409


def test_video_exige_sessao(ambiente) -> None:
    c, _, _ = ambiente
    assert c.get("/exercicios/figure8/video").status_code == 401


def test_video_sem_acesso_devolve_403_sem_assinar_nada(ambiente) -> None:
    c, _, presigner = ambiente
    _entrar(c)
    assert c.get("/exercicios/figure8/video").status_code == 403
    assert presigner.chaves == []


def test_video_premium_durante_trial_devolve_403(ambiente) -> None:
    c, _, presigner = ambiente
    _entrar(c)
    c.post("/exercicios/trial")
    assert c.get("/exercicios/figure8/video").status_code == 200
    assert c.get("/exercicios/estereopsia/video").status_code == 403
    assert presigner.chaves == ["videos-exercicios/figure8.mp4"]


def test_video_de_exercicio_eliminado_devolve_404(ambiente) -> None:
    c, repo, _ = ambiente
    repo.conta = _conta(papel="admin")
    _entrar(c)
    assert c.get("/exercicios/programa-ia/video").status_code == 404


def test_video_sem_bucket_configurado_devolve_503_so_a_quem_tem_acesso(ambiente) -> None:
    c, repo, _ = ambiente
    app.dependency_overrides[obter_presigner_videos] = lambda: None
    _entrar(c)
    assert c.get("/exercicios/figure8/video").status_code == 403
    repo.conta = _conta(premium_ativo=True, premium_expira_em=datetime.now(UTC) + timedelta(days=1))
    assert c.get("/exercicios/figure8/video").status_code == 503
