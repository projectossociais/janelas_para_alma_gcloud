"""`/apoios-mensais`: exige sessão, o dono é sempre o utilizador do JWT, e
nunca um 201 para um comprovativo que não ficou gravado."""

from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.core.config import obter_settings
from app.core.dependencies import obter_auth_service
from app.core.security import criar_access_token, hash_password
from app.main import app
from app.repositories.utilizadores_repository import UtilizadorRegisto
from app.routers.apoios_mensais import obter_apoio_mensal_service
from app.services.apoio_mensal_service import ApoioMensalService
from app.services.auth_service import AuthService
from tests.services.test_apoio_mensal_service import EmailSenderFalso, RepositorioApoiosFalso
from tests.services.test_auth_service import RepositorioFalso as RepositorioAuthFalso


@pytest.fixture(autouse=True)
def _sem_bucket_privado(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(obter_settings(), "r2_public_base_url", "https://cdn.exemplo.test")
    monkeypatch.setattr(obter_settings(), "r2_bucket_comprovativos", "")


def _seed(repo_auth: RepositorioAuthFalso, id_: str) -> str:
    repo_auth._utilizadores[f"{id_}@example.com"] = UtilizadorRegisto(
        id=id_,
        email=f"{id_}@example.com",
        password_hash=hash_password("password-forte-123"),
        papel="comum",
        nome_completo=None,
        provincia=None,
        genero=None,
        criado_em=datetime.now(UTC),
    )
    return criar_access_token(id_)


def _ambiente(repo: RepositorioApoiosFalso, email: EmailSenderFalso):
    repo_auth = RepositorioAuthFalso()
    tokens = {u: _seed(repo_auth, u) for u in ("ana", "bruno")}
    app.dependency_overrides[obter_auth_service] = lambda: AuthService(repo_auth)
    app.dependency_overrides[obter_apoio_mensal_service] = lambda: ApoioMensalService(repo, email)
    return tokens


@pytest.fixture
def ambiente():
    repo, email = RepositorioApoiosFalso(), EmailSenderFalso()
    tokens = _ambiente(repo, email)
    with TestClient(app) as c:
        yield c, repo, email, tokens
    app.dependency_overrides.clear()


def test_sem_sessao_devolve_401(ambiente) -> None:
    c, *_ = ambiente
    assert c.get("/apoios-mensais/meu").status_code == 401
    assert c.post("/apoios-mensais", json={"valor_mensal_kz": 15000}).status_code == 401


def test_sem_apoio_devolve_null(ambiente) -> None:
    c, _, _, tokens = ambiente
    c.cookies.set("access_token", tokens["ana"])
    resposta = c.get("/apoios-mensais/meu")
    assert resposta.status_code == 200
    assert resposta.json() is None


def test_aderir_e_ler_o_proprio_apoio(ambiente) -> None:
    c, repo, _, tokens = ambiente
    c.cookies.set("access_token", tokens["ana"])

    criado = c.post("/apoios-mensais", json={"valor_mensal_kz": 15000})

    assert criado.status_code == 201
    assert criado.json()["valor_mensal_kz"] == 15000
    assert c.get("/apoios-mensais/meu").json()["id"] == criado.json()["id"]
    # O dono vem do JWT: a outra conta não vê o apoio da Ana.
    c.cookies.set("access_token", tokens["bruno"])
    assert c.get("/apoios-mensais/meu").json() is None
    assert next(iter(repo.apoios.values())).utilizador_id == "ana"


def test_valor_abaixo_do_minimo_devolve_422(ambiente) -> None:
    c, _, _, tokens = ambiente
    c.cookies.set("access_token", tokens["ana"])
    assert c.post("/apoios-mensais", json={"valor_mensal_kz": 500}).status_code == 422


def test_segundo_apoio_activo_devolve_409(ambiente) -> None:
    c, _, _, tokens = ambiente
    c.cookies.set("access_token", tokens["ana"])
    c.post("/apoios-mensais", json={"valor_mensal_kz": 5000})
    assert c.post("/apoios-mensais", json={"valor_mensal_kz": 30000}).status_code == 409


def test_comprovativo_usa_o_email_da_conta(ambiente) -> None:
    c, repo, email, tokens = ambiente
    c.cookies.set("access_token", tokens["ana"])
    c.post("/apoios-mensais", json={"valor_mensal_kz": 15000})

    resposta = c.post("/apoios-mensais/meu/comprovativos", json={"comprovativo_chave": "comprovativos/a.pdf"})

    assert resposta.status_code == 201
    assert resposta.json()["meses_com_comprovativo"] == 1
    assert repo.doacoes[0]["email"] == "ana@example.com"
    assert email.enviados[0]["destinatario"] == "ana@example.com"


def test_comprovativo_sem_apoio_devolve_404(ambiente) -> None:
    c, _, _, tokens = ambiente
    c.cookies.set("access_token", tokens["ana"])
    resposta = c.post("/apoios-mensais/meu/comprovativos", json={"comprovativo_chave": "comprovativos/a.pdf"})
    assert resposta.status_code == 404


def test_comprovativo_com_chave_fora_do_prefixo_devolve_403(ambiente) -> None:
    c, _, _, tokens = ambiente
    c.cookies.set("access_token", tokens["ana"])
    c.post("/apoios-mensais", json={"valor_mensal_kz": 15000})
    resposta = c.post("/apoios-mensais/meu/comprovativos", json={"comprovativo_chave": "avatares/x/foto.png"})
    assert resposta.status_code == 403


def test_nunca_devolve_201_quando_a_gravacao_falha() -> None:
    repo = RepositorioApoiosFalso(falhar_ao_gravar=True)
    tokens = _ambiente(repo, EmailSenderFalso())
    try:
        with TestClient(app, raise_server_exceptions=False) as c:
            c.cookies.set("access_token", tokens["ana"])
            c.post("/apoios-mensais", json={"valor_mensal_kz": 15000})
            resposta = c.post(
                "/apoios-mensais/meu/comprovativos", json={"comprovativo_chave": "comprovativos/a.pdf"}
            )
        assert resposta.status_code == 500
    finally:
        app.dependency_overrides.clear()


def test_cancelar(ambiente) -> None:
    c, _, _, tokens = ambiente
    c.cookies.set("access_token", tokens["ana"])
    c.post("/apoios-mensais", json={"valor_mensal_kz": 15000})

    assert c.delete("/apoios-mensais/meu").status_code == 204
    assert c.get("/apoios-mensais/meu").json() is None
    assert c.delete("/apoios-mensais/meu").status_code == 404
