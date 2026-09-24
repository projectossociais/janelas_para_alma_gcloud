from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.core.dependencies import (
    obter_auth_service,
    obter_confirmacao_email_service,
    obter_conta_service,
)
from app.main import app
from app.repositories.screening_repository import ScreeningRegisto
from app.routers.screenings import obter_screenings_repository
from app.services.auth_service import AuthService
from app.services.confirmacao_email_service import ConfirmacaoEmailService
from app.services.conta_service import ContaService
from tests.services.test_auth_service import RepositorioFalso
from tests.services.test_confirmacao_email_service import TokensConfirmacaoRepositorioFalso
from tests.services.test_recuperacao_password_service import EmailSenderFalso


class RepositorioScreeningsFalso:
    def __init__(self) -> None:
        self.gravadas: list[dict] = []
        self.a_falhar = False

    def criar(
        self,
        user_id: str,
        estado: str,
        rosto_detetado: bool,
        requer_avaliacao_humana: bool,
        diagnostico: str,
        assimetria_horizontal: float | None,
        assimetria_vertical: float | None,
        qualidade_captura: float | None,
        qualidade_fiavel: bool | None,
        qualidade_motivos: list[str],
        medicoes: dict | None,
        versao_analise: str | None,
    ) -> ScreeningRegisto:
        if self.a_falhar:
            raise RuntimeError("falha simulada na gravação")
        registo = {
            "user_id": user_id,
            "estado": estado,
            "rosto_detetado": rosto_detetado,
            "requer_avaliacao_humana": requer_avaliacao_humana,
            "diagnostico": diagnostico,
            "encaminhado": False,
            "assimetria_horizontal": assimetria_horizontal,
            "assimetria_vertical": assimetria_vertical,
            "qualidade_captura": qualidade_captura,
            "qualidade_fiavel": qualidade_fiavel,
            "qualidade_motivos": qualidade_motivos,
            "medicoes": medicoes,
            "versao_analise": versao_analise,
        }
        self.gravadas.append(registo)
        return ScreeningRegisto(
            id=f"screening-{len(self.gravadas)}", criado_em=datetime.now(UTC), **registo
        )

    def listar_do_utilizador(self, user_id: str, limite: int = 50) -> list[ScreeningRegisto]:
        return [
            ScreeningRegisto(id=f"screening-{i}", criado_em=datetime.now(UTC), **r)
            for i, r in enumerate(self.gravadas)
            if r["user_id"] == user_id
        ][:limite]


@pytest.fixture
def ambiente():
    repo_auth = RepositorioFalso()
    repo_screenings = RepositorioScreeningsFalso()
    app.dependency_overrides[obter_auth_service] = lambda: AuthService(repo_auth)
    app.dependency_overrides[obter_screenings_repository] = lambda: repo_screenings
    app.dependency_overrides[obter_conta_service] = lambda: ContaService(repo_auth)
    app.dependency_overrides[obter_confirmacao_email_service] = lambda: ConfirmacaoEmailService(
        repo_auth, TokensConfirmacaoRepositorioFalso(), EmailSenderFalso()
    )
    with TestClient(app) as c:
        c.repo_auth = repo_auth  # type: ignore[attr-defined]
        yield c, repo_screenings
    app.dependency_overrides.clear()


def _registar(c: TestClient) -> str:
    r = c.post("/auth/registar", json={"email": "ana@example.com", "password": "password-forte-123"})
    utilizador_id = r.json()["id"]
    c.repo_auth.confirmar_email(utilizador_id)  # type: ignore[attr-defined]
    c.post("/auth/entrar", json={"email": "ana@example.com", "password": "password-forte-123"})
    return utilizador_id


PAYLOAD_VALIDO = {
    "estado": "concluido",
    "rosto_detetado": True,
    "requer_avaliacao_humana": False,
    "diagnostico": "normal",
    "assimetria_horizontal": 1.2,
    "assimetria_vertical": 0.3,
    "qualidade_captura": 0.91,
    "qualidade_fiavel": True,
    "qualidade_motivos": [],
    "medicoes": {"posicoes": []},
    "versao_analise": "janelas-scanner-api@1",
}


def test_sem_sessao_devolve_401(ambiente) -> None:
    c, _ = ambiente
    assert c.post("/screenings", json=PAYLOAD_VALIDO).status_code == 401


def test_grava_com_user_id_do_jwt_ignorando_o_do_corpo(ambiente) -> None:
    c, repo = ambiente
    utilizador_id = _registar(c)

    resposta = c.post(
        "/screenings",
        json={**PAYLOAD_VALIDO, "user_id": "00000000-0000-0000-0000-000000000000"},
    )

    assert resposta.status_code == 201
    assert resposta.json()["user_id"] == utilizador_id
    assert repo.gravadas[0]["user_id"] == utilizador_id


def test_nunca_aceita_campo_de_imagem(ambiente) -> None:
    """CLAUDE.md secção 4, regra 4: nunca guardar a fotografia do scanner.
    O schema nem sequer tem esse campo -- um `imagem`/`imagem_base64` extra
    enviado no corpo é ignorado, nunca chega ao repository."""
    c, repo = ambiente
    _registar(c)

    resposta = c.post(
        "/screenings",
        json={**PAYLOAD_VALIDO, "imagem_base64": "data:image/png;base64,AAAA"},
    )

    assert resposta.status_code == 201
    assert "imagem" not in repo.gravadas[0]
    assert "imagem_base64" not in resposta.json()


def test_estado_em_branco_devolve_422(ambiente) -> None:
    c, _ = ambiente
    _registar(c)
    resposta = c.post("/screenings", json={**PAYLOAD_VALIDO, "estado": ""})
    assert resposta.status_code == 422


def test_diagnostico_omitido_usa_normal_por_omissao(ambiente) -> None:
    c, repo = ambiente
    _registar(c)
    dados = {k: v for k, v in PAYLOAD_VALIDO.items() if k != "diagnostico"}

    resposta = c.post("/screenings", json=dados)

    assert resposta.status_code == 201
    assert resposta.json()["diagnostico"] == "normal"
    assert repo.gravadas[0]["diagnostico"] == "normal"


def test_diagnostico_requer_avaliacao_e_gravado(ambiente) -> None:
    c, repo = ambiente
    _registar(c)

    resposta = c.post("/screenings", json={**PAYLOAD_VALIDO, "diagnostico": "requer_avaliacao"})

    assert resposta.status_code == 201
    assert resposta.json()["diagnostico"] == "requer_avaliacao"
    assert repo.gravadas[0]["diagnostico"] == "requer_avaliacao"


def test_diagnostico_com_valor_forjado_devolve_422(ambiente) -> None:
    c, _ = ambiente
    _registar(c)
    resposta = c.post("/screenings", json={**PAYLOAD_VALIDO, "diagnostico": "esotropia"})
    assert resposta.status_code == 422


def test_nunca_201_quando_a_gravacao_falha() -> None:
    repo_auth = RepositorioFalso()
    repo_screenings = RepositorioScreeningsFalso()
    repo_screenings.a_falhar = True
    app.dependency_overrides[obter_auth_service] = lambda: AuthService(repo_auth)
    app.dependency_overrides[obter_screenings_repository] = lambda: repo_screenings
    app.dependency_overrides[obter_conta_service] = lambda: ContaService(repo_auth)
    app.dependency_overrides[obter_confirmacao_email_service] = lambda: ConfirmacaoEmailService(
        repo_auth, TokensConfirmacaoRepositorioFalso(), EmailSenderFalso()
    )
    try:
        with TestClient(app, raise_server_exceptions=False) as c:
            c.repo_auth = repo_auth  # type: ignore[attr-defined]
            _registar(c)
            resposta = c.post("/screenings", json=PAYLOAD_VALIDO)
    finally:
        app.dependency_overrides.clear()

    assert resposta.status_code == 500
    assert resposta.status_code != 201
    assert repo_screenings.gravadas == []


def test_listar_minhas_devolve_so_as_do_proprio_utilizador(ambiente) -> None:
    c, repo = ambiente
    utilizador_id = _registar(c)
    c.post("/screenings", json=PAYLOAD_VALIDO)
    repo.gravadas.append({**PAYLOAD_VALIDO, "user_id": "outro-utilizador", "encaminhado": False})

    resposta = c.get("/screenings/minhas")

    assert resposta.status_code == 200
    corpo = resposta.json()
    assert len(corpo) == 1
    assert corpo[0]["user_id"] == utilizador_id


def test_listar_minhas_sem_sessao_devolve_401(ambiente) -> None:
    c, _ = ambiente
    assert c.get("/screenings/minhas").status_code == 401
