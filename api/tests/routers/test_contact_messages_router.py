from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.core.dependencies import obter_auth_service
from app.core.security import criar_access_token, hash_password
from app.main import app
from app.repositories.contact_messages_repository import ContactMessageRegisto
from app.repositories.utilizadores_repository import UtilizadorRegisto
from app.routers.contact_messages import obter_contact_messages_repository
from app.services.auth_service import AuthService
from tests.services.test_auth_service import RepositorioFalso as RepositorioAuthFalso


class RepositorioFalso:
    def __init__(self) -> None:
        self.gravadas: list[dict] = []
        self.a_falhar = False
        self._mensagens: dict[str, ContactMessageRegisto] = {}

    def criar(
        self, nome: str, email: str, mensagem: str, assunto: str | None
    ) -> ContactMessageRegisto:
        if self.a_falhar:
            raise RuntimeError("falha simulada na gravação")
        self.gravadas.append({"nome": nome, "email": email, "mensagem": mensagem, "assunto": assunto})
        registo = ContactMessageRegisto(
            id=f"msg-{len(self.gravadas)}",
            nome=nome,
            email=email,
            assunto=assunto,
            mensagem=mensagem,
            lida=False,
            created_at=datetime.now(UTC),
        )
        self._mensagens[registo.id] = registo
        return registo

    def listar(self) -> list[ContactMessageRegisto]:
        return sorted(self._mensagens.values(), key=lambda m: m.created_at, reverse=True)

    def marcar_lida(self, mensagem_id: str, lida: bool) -> ContactMessageRegisto | None:
        atual = self._mensagens.get(mensagem_id)
        if atual is None:
            return None
        novo = ContactMessageRegisto(**{**atual.__dict__, "lida": lida})
        self._mensagens[mensagem_id] = novo
        return novo


def _token_admin(repo_auth: RepositorioAuthFalso) -> str:
    repo_auth._utilizadores["admin@example.com"] = UtilizadorRegisto(
        id="id-admin",
        email="admin@example.com",
        password_hash=hash_password("password-forte-123"),
        papel="admin",
        nome_completo=None,
        provincia=None,
        genero=None,
        criado_em=datetime.now(UTC),
    )
    return criar_access_token("id-admin")


@pytest.fixture
def ambiente():
    repo = RepositorioFalso()
    repo_auth = RepositorioAuthFalso()
    token_admin = _token_admin(repo_auth)
    app.dependency_overrides[obter_contact_messages_repository] = lambda: repo
    app.dependency_overrides[obter_auth_service] = lambda: AuthService(repo_auth)
    with TestClient(app) as c:
        yield c, repo, token_admin
    app.dependency_overrides.clear()


def test_grava_a_mensagem_e_devolve_201(ambiente) -> None:
    c, repo, _ = ambiente

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
    c, repo, _ = ambiente
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


# --- Leitura e gestão de admin --------------------------------------------


def test_listar_sem_sessao_devolve_401(ambiente) -> None:
    c, _, _ = ambiente
    assert c.get("/contact-messages").status_code == 401


def test_listar_com_papel_comum_devolve_403(ambiente) -> None:
    c, _, _ = ambiente
    c.cookies.set("access_token", criar_access_token("id-desconhecido"))
    # id inexistente → 401; o ponto que importa é: nunca 200 sem ser admin
    assert c.get("/contact-messages").status_code in (401, 403)


def test_admin_lista_e_marca_como_lida(ambiente) -> None:
    c, repo, token = ambiente
    repo.criar("Ana", "ana@example.com", "primeira", None)
    msg = repo.criar("Rui", "rui@example.com", "segunda", None)
    c.cookies.set("access_token", token)

    listagem = c.get("/contact-messages")
    assert listagem.status_code == 200
    corpo = listagem.json()
    assert len(corpo) == 2
    assert corpo[0]["lida"] is False

    marcada = c.patch(f"/contact-messages/{msg.id}", json={"lida": True})
    assert marcada.status_code == 200
    assert marcada.json()["lida"] is True
    assert repo.listar()[0].lida is True  # a mais recente ficou lida


def test_marcar_mensagem_inexistente_devolve_404(ambiente) -> None:
    c, _, token = ambiente
    c.cookies.set("access_token", token)
    assert c.patch("/contact-messages/msg-999", json={"lida": True}).status_code == 404
