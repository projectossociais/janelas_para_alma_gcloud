from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.core.dependencies import obter_auth_service
from app.core.security import criar_access_token, hash_password
from app.main import app
from app.repositories.banners_repository import BannerPatch, BannerRegisto
from app.repositories.utilizadores_repository import UtilizadorRegisto
from app.routers.banners import obter_banners_repository
from app.services.auth_service import AuthService
from tests.services.test_auth_service import RepositorioFalso


class RepositorioBannersFalso:
    """Mesmo contrato (Protocol) que o repositório real, em memória."""

    def __init__(self, banners: list[BannerRegisto] | None = None) -> None:
        self._banners: list[BannerRegisto] = list(banners or [])
        self._proximo = len(self._banners) + 1

    def obter_ativo(self) -> BannerRegisto | None:
        ativos = [b for b in self._banners if b.ativo]
        return max(ativos, key=lambda b: b.created_at) if ativos else None

    def listar(self) -> list[BannerRegisto]:
        return sorted(self._banners, key=lambda b: b.created_at, reverse=True)

    def criar(self, titulo: str, mensagem: str, link: str | None, ativo: bool) -> BannerRegisto:
        registo = BannerRegisto(
            id=f"banner-{self._proximo}",
            titulo=titulo,
            mensagem=mensagem,
            link=link,
            ativo=ativo,
            created_at=datetime.now(UTC),
        )
        self._proximo += 1
        self._banners.append(registo)
        return registo

    def atualizar(self, banner_id: str, patch: BannerPatch) -> BannerRegisto | None:
        for i, b in enumerate(self._banners):
            if b.id == banner_id:
                mudancas = {k: v for k, v in patch.__dict__.items() if v is not None}
                self._banners[i] = BannerRegisto(**{**b.__dict__, **mudancas})
                return self._banners[i]
        return None

    def apagar(self, banner_id: str) -> bool:
        antes = len(self._banners)
        self._banners = [b for b in self._banners if b.id != banner_id]
        return len(self._banners) < antes


def _seed(repo_auth: RepositorioFalso, id_: str, papel: str) -> str:
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
    repo_auth = RepositorioFalso()
    repo_banners = RepositorioBannersFalso()
    token_admin = _seed(repo_auth, "id-admin", "admin")
    token_comum = _seed(repo_auth, "id-comum", "comum")
    app.dependency_overrides[obter_auth_service] = lambda: AuthService(repo_auth)
    app.dependency_overrides[obter_banners_repository] = lambda: repo_banners
    with TestClient(app) as c:
        yield c, repo_banners, token_admin, token_comum
    app.dependency_overrides.clear()


# --- Leitura pública ---------------------------------------------------------


def test_sem_banner_ativo_devolve_null(ambiente) -> None:
    c, *_ = ambiente
    resposta = c.get("/banners/ativo")
    assert resposta.status_code == 200
    assert resposta.json() is None


def test_devolve_o_banner_ativo(ambiente) -> None:
    c, repo, *_ = ambiente
    repo.criar("Aviso", "Estamos em manutenção", None, True)
    resposta = c.get("/banners/ativo")
    assert resposta.status_code == 200
    assert resposta.json()["titulo"] == "Aviso"
    assert "ativo" not in resposta.json()  # BannerPublico não expõe `ativo`


# --- Gestão exige admin ----------------------------------------------------


def test_listar_sem_sessao_devolve_401(ambiente) -> None:
    c, *_ = ambiente
    assert c.get("/banners").status_code == 401


def test_criar_com_sessao_de_papel_comum_devolve_403(ambiente) -> None:
    c, _, _, token_comum = ambiente
    c.cookies.set("access_token", token_comum)
    resposta = c.post("/banners", json={"titulo": "X", "mensagem": "Y"})
    assert resposta.status_code == 403


def test_admin_cria_lista_e_apaga(ambiente) -> None:
    c, _, token, _ = ambiente
    c.cookies.set("access_token", token)

    criado = c.post("/banners", json={"titulo": "Campanha", "mensagem": "Doe já", "link": "/apoiar"})
    assert criado.status_code == 201
    corpo = criado.json()
    assert corpo["titulo"] == "Campanha"
    assert corpo["ativo"] is True
    banner_id = corpo["id"]

    listagem = c.get("/banners")
    assert listagem.status_code == 200
    assert [b["id"] for b in listagem.json()] == [banner_id]

    apagado = c.request("DELETE", f"/banners/{banner_id}")
    assert apagado.status_code == 204
    assert c.get("/banners").json() == []


def test_admin_desativa_banner_com_patch(ambiente) -> None:
    c, repo, token, _ = ambiente
    c.cookies.set("access_token", token)
    banner_id = repo.criar("Aviso", "Texto", None, True).id

    resposta = c.patch(f"/banners/{banner_id}", json={"ativo": False})

    assert resposta.status_code == 200
    assert resposta.json()["ativo"] is False
    assert c.get("/banners/ativo").json() is None


def test_patch_de_banner_inexistente_devolve_404(ambiente) -> None:
    c, _, token, _ = ambiente
    c.cookies.set("access_token", token)
    resposta = c.patch("/banners/banner-999", json={"titulo": "Novo"})
    assert resposta.status_code == 404


def test_delete_de_banner_inexistente_devolve_404(ambiente) -> None:
    c, _, token, _ = ambiente
    c.cookies.set("access_token", token)
    assert c.request("DELETE", "/banners/banner-999").status_code == 404
