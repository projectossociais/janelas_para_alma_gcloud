import pytest
from fastapi.testclient import TestClient

from app.core.config import obter_settings
from app.core.dependencies import obter_auth_service
from app.main import app
from app.routers import uploads as uploads_router
from app.services.auth_service import AuthService
from app.services.upload_service import UploadService
from tests.services.test_auth_service import RepositorioFalso
from tests.services.test_upload_service import AvatarRepositorioFalso, PresignerFalso

BASE_PUBLICA = "https://cdn.exemplo.test"


@pytest.fixture(autouse=True)
def _base_publica(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(obter_settings(), "r2_public_base_url", BASE_PUBLICA)


@pytest.fixture
def client():
    repo_auth = RepositorioFalso()
    avatares = AvatarRepositorioFalso()
    app.dependency_overrides[obter_auth_service] = lambda: AuthService(repo_auth)
    app.dependency_overrides[uploads_router.obter_upload_service] = lambda: UploadService(
        PresignerFalso(), avatares
    )
    with TestClient(app) as c:
        yield c, avatares
    app.dependency_overrides.clear()


def _registar(c: TestClient) -> str:
    resposta = c.post(
        "/auth/registar", json={"email": "ana@example.com", "password": "password-forte-123"}
    )
    return resposta.json()["id"]


def test_preparar_sem_sessao_devolve_401(client) -> None:
    c, _ = client
    assert c.post("/uploads/avatar", json={"content_type": "image/png"}).status_code == 401


def test_preparar_devolve_url_assinado_e_chave_do_utilizador(client) -> None:
    c, _ = client
    utilizador_id = _registar(c)

    resposta = c.post("/uploads/avatar", json={"content_type": "image/png"})

    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["chave"].startswith(f"avatares/{utilizador_id}/")
    assert corpo["url_publico"] == f"{BASE_PUBLICA}/{corpo['chave']}"
    assert corpo["url_de_upload"].startswith("https://r2.exemplo.test/")


def test_preparar_recusa_tipo_de_ficheiro_invalido_com_422(client) -> None:
    c, _ = client
    _registar(c)
    resposta = c.post("/uploads/avatar", json={"content_type": "application/pdf"})
    assert resposta.status_code == 422


def test_confirmar_grava_avatar_quando_a_chave_e_do_proprio(client) -> None:
    c, avatares = client
    utilizador_id = _registar(c)
    chave = f"avatares/{utilizador_id}/foto.png"

    resposta = c.post("/uploads/avatar/confirmar", json={"chave": chave})

    assert resposta.status_code == 200
    assert resposta.json()["avatar_url"] == f"{BASE_PUBLICA}/{chave}"
    assert avatares.gravado == {utilizador_id: f"{BASE_PUBLICA}/{chave}"}


def test_confirmar_recusa_chave_de_outro_utilizador_com_403(client) -> None:
    c, avatares = client
    _registar(c)

    resposta = c.post("/uploads/avatar/confirmar", json={"chave": "avatares/outro-id/foto.png"})

    assert resposta.status_code == 403
    assert avatares.gravado == {}
