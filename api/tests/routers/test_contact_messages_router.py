from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.repositories.contact_messages_repository import ContactMessageRegisto
from app.routers.contact_messages import obter_contact_messages_repository


class RepositorioFalso:
    def __init__(self) -> None:
        self.gravadas: list[dict] = []
        self.a_falhar = False

    def criar(
        self, nome: str, email: str, mensagem: str, assunto: str | None
    ) -> ContactMessageRegisto:
        if self.a_falhar:
            raise RuntimeError("falha simulada na gravação")
        self.gravadas.append({"nome": nome, "email": email, "mensagem": mensagem, "assunto": assunto})
        return ContactMessageRegisto(
            id=f"msg-{len(self.gravadas)}",
            nome=nome,
            email=email,
            assunto=assunto,
            mensagem=mensagem,
            lida=False,
            created_at=datetime.now(UTC),
        )


@pytest.fixture
def ambiente():
    repo = RepositorioFalso()
    app.dependency_overrides[obter_contact_messages_repository] = lambda: repo
    with TestClient(app) as c:
        yield c, repo
    app.dependency_overrides.clear()


def test_grava_a_mensagem_e_devolve_201(ambiente) -> None:
    c, repo = ambiente

    resposta = c.post(
        "/contact-messages",
        json={"nome": "Ana", "email": "ana@example.com", "mensagem": "Olá, tenho uma dúvida."},
    )

    assert resposta.status_code == 201
    assert resposta.json()["nome"] == "Ana"
    assert repo.gravadas == [
        {"nome": "Ana", "email": "ana@example.com", "mensagem": "Olá, tenho uma dúvida.", "assunto": None}
    ]


def test_nao_exige_sessao() -> None:
    # sem cookie nenhum — o endpoint é público
    repo = RepositorioFalso()
    app.dependency_overrides[obter_contact_messages_repository] = lambda: repo
    try:
        with TestClient(app) as c:
            resposta = c.post(
                "/contact-messages",
                json={"nome": "X", "email": "x@example.com", "mensagem": "oi"},
            )
    finally:
        app.dependency_overrides.clear()
    assert resposta.status_code == 201


@pytest.mark.parametrize(
    "corpo",
    [
        {"nome": "", "email": "a@b.com", "mensagem": "oi"},
        {"nome": "Ana", "email": "sem-arroba", "mensagem": "oi"},
        {"nome": "Ana", "email": "a@b.com", "mensagem": ""},
        {"nome": "Ana", "email": "a@b.com"},
    ],
)
def test_validacao_de_forma_devolve_422(ambiente, corpo) -> None:
    c, repo = ambiente
    assert c.post("/contact-messages", json=corpo).status_code == 422
    assert repo.gravadas == []


def test_nunca_201_quando_a_gravacao_falha() -> None:
    repo = RepositorioFalso()
    repo.a_falhar = True
    app.dependency_overrides[obter_contact_messages_repository] = lambda: repo
    try:
        with TestClient(app, raise_server_exceptions=False) as c:
            resposta = c.post(
                "/contact-messages",
                json={"nome": "Ana", "email": "ana@example.com", "mensagem": "oi"},
            )
    finally:
        app.dependency_overrides.clear()

    assert resposta.status_code == 500
    assert resposta.status_code != 201
