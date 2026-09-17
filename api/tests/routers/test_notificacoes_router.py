from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.core.dependencies import obter_auth_service
from app.core.security import criar_access_token, hash_password
from app.main import app
from app.repositories.utilizadores_repository import UtilizadorRegisto
from app.routers import notificacoes as notificacoes_router
from app.services.auth_service import AuthService
from app.services.notification_service import NotificationService
from tests.services.test_auth_service import RepositorioFalso as RepositorioAuthFalso
from tests.services.test_notification_service import (
    EmailSenderFalso,
    RepositorioNotificacoesFalso,
    UtilizadoresFalso,
    UtilizadorFalso,
)


def _seed(repo_auth: RepositorioAuthFalso, id_: str, papel: str) -> str:
    repo_auth._utilizadores[f"{id_}@example.com"] = UtilizadorRegisto(
        id=id_,
        email=f"{id_}@example.com",
        password_hash=hash_password("password-forte-123"),
        papel=papel,
        nome_completo=None,
        provincia=None,
        genero=None,
        criado_em=datetime.now(UTC),
    )
    return criar_access_token(id_)


@pytest.fixture
def ambiente():
    repo_auth = RepositorioAuthFalso()
    repo_notif = RepositorioNotificacoesFalso()
    utilizadores = UtilizadoresFalso(
        [
            UtilizadorFalso(id="id-admin", papel="admin", email="admin@example.com"),
            UtilizadorFalso(id="id-comum", papel="comum", email="comum@example.com"),
        ]
    )
    email_sender = EmailSenderFalso()
    token_admin = _seed(repo_auth, "id-admin", "admin")
    token_comum = _seed(repo_auth, "id-comum", "comum")
    app.dependency_overrides[obter_auth_service] = lambda: AuthService(repo_auth)
    app.dependency_overrides[notificacoes_router.obter_notification_service] = (
        lambda: NotificationService(repo_notif, utilizadores, email_sender)
    )
    with TestClient(app) as c:
        yield c, repo_notif, token_admin, token_comum, email_sender
    app.dependency_overrides.clear()


def test_listar_minhas_sem_sessao_devolve_401(ambiente) -> None:
    c, *_ = ambiente
    assert c.get("/notificacoes").status_code == 401


def test_listar_minhas_devolve_so_as_do_utilizador(ambiente) -> None:
    c, repo, _, token_comum, _ = ambiente
    repo.criar_em_massa(["id-comum"], "Aviso", "Texto")
    repo.criar_em_massa(["id-admin"], "Outro aviso", "Texto")

    c.cookies.set("access_token", token_comum)
    resposta = c.get("/notificacoes")

    assert resposta.status_code == 200
    assert [n["titulo"] for n in resposta.json()] == ["Aviso"]


def test_contar_nao_lidas(ambiente) -> None:
    c, repo, _, token_comum, _ = ambiente
    repo.criar_em_massa(["id-comum"], "Aviso", "Texto")
    c.cookies.set("access_token", token_comum)

    resposta = c.get("/notificacoes/nao-lidas/contagem")

    assert resposta.status_code == 200
    assert resposta.json()["contagem"] == 1


def test_marcar_lida_da_propria(ambiente) -> None:
    c, repo, _, token_comum, _ = ambiente
    repo.criar_em_massa(["id-comum"], "Aviso", "Texto")
    c.cookies.set("access_token", token_comum)
    notif_id = c.get("/notificacoes").json()[0]["id"]

    resposta = c.post(f"/notificacoes/{notif_id}/marcar-lida")

    assert resposta.status_code == 200
    assert resposta.json()["lida"] is True


def test_marcar_lida_de_outro_utilizador_devolve_404(ambiente) -> None:
    c, repo, token_admin, token_comum, _ = ambiente
    repo.criar_em_massa(["id-comum"], "Aviso", "Texto")
    c.cookies.set("access_token", token_comum)
    notif_id = c.get("/notificacoes").json()[0]["id"]

    c.cookies.set("access_token", token_admin)
    resposta = c.post(f"/notificacoes/{notif_id}/marcar-lida")

    assert resposta.status_code == 404


def test_marcar_todas_lidas(ambiente) -> None:
    c, repo, _, token_comum, _ = ambiente
    repo.criar_em_massa(["id-comum", "id-comum"], "Aviso", "Texto")
    c.cookies.set("access_token", token_comum)

    resposta = c.post("/notificacoes/marcar-todas-lidas")

    assert resposta.status_code == 204
    assert c.get("/notificacoes/nao-lidas/contagem").json()["contagem"] == 0


def test_enviar_sem_sessao_devolve_401(ambiente) -> None:
    c, *_ = ambiente
    resposta = c.post("/notificacoes/admin/enviar", json={"titulo": "X", "mensagem": "Y"})
    assert resposta.status_code == 401


def test_enviar_com_papel_comum_devolve_403(ambiente) -> None:
    c, _, _, token_comum, _ = ambiente
    c.cookies.set("access_token", token_comum)
    resposta = c.post("/notificacoes/admin/enviar", json={"titulo": "X", "mensagem": "Y"})
    assert resposta.status_code == 403


def test_admin_envia_a_todos(ambiente) -> None:
    c, _, token_admin, _, _ = ambiente
    c.cookies.set("access_token", token_admin)

    resposta = c.post("/notificacoes/admin/enviar", json={"titulo": "Manutenção", "mensagem": "Já já volta"})

    assert resposta.status_code == 200
    assert resposta.json()["enviadas"] == 2  # os dois utilizadores da fixture


def test_admin_envia_so_a_um_papel(ambiente) -> None:
    c, _, token_admin, _, _ = ambiente
    c.cookies.set("access_token", token_admin)

    resposta = c.post(
        "/notificacoes/admin/enviar", json={"titulo": "Aviso", "mensagem": "Texto", "papel": "comum"}
    )

    assert resposta.status_code == 200
    assert resposta.json()["enviadas"] == 1


def test_admin_recusa_papel_invalido_com_422(ambiente) -> None:
    c, _, token_admin, _, _ = ambiente
    c.cookies.set("access_token", token_admin)

    resposta = c.post(
        "/notificacoes/admin/enviar",
        json={"titulo": "Aviso", "mensagem": "Texto", "papel": "super-hacker"},
    )

    assert resposta.status_code == 422


def test_sem_pedir_email_a_resposta_vem_a_zero(ambiente) -> None:
    c, _, token_admin, _, email_sender = ambiente
    c.cookies.set("access_token", token_admin)

    resposta = c.post("/notificacoes/admin/enviar", json={"titulo": "Aviso", "mensagem": "Texto"})

    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["emails_enviados"] == 0
    assert corpo["emails_falharam"] == 0
    assert email_sender.enviados == []


def test_admin_pede_tambem_por_email(ambiente) -> None:
    c, _, token_admin, _, email_sender = ambiente
    c.cookies.set("access_token", token_admin)

    resposta = c.post(
        "/notificacoes/admin/enviar",
        json={"titulo": "Manutenção", "mensagem": "Já já volta", "enviar_email": True},
    )

    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["enviadas"] == 2
    assert corpo["emails_enviados"] == 2
    assert corpo["emails_falharam"] == 0
    assert {e[0] for e in email_sender.enviados} == {"admin@example.com", "comum@example.com"}
