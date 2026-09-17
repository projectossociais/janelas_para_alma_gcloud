from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.core.dependencies import obter_auth_service
from app.core.security import criar_access_token, hash_password
from app.main import app
from app.repositories.banner_homepage_repository import BannerHomepagePatch, BannerHomepageRegisto
from app.repositories.utilizadores_repository import UtilizadorRegisto
from app.routers import banner_homepage as banner_homepage_router
from app.services.auth_service import AuthService
from app.services.banner_homepage_upload_service import BannerHomepageUploadService
from tests.services.test_auth_service import RepositorioFalso as RepositorioAuthFalso
from tests.services.test_upload_service import PresignerFalso


class RepositorioBannerHomepageFalso:
    """Mesmo contrato (Protocol) que o repositório real, em memória."""

    def __init__(self) -> None:
        self._banners: list[BannerHomepageRegisto] = []
        self._proximo = 1

    def obter_ativo(self) -> BannerHomepageRegisto | None:
        candidatos = [b for b in self._banners if b.ativo and b.imagem_url is not None]
        return max(candidatos, key=lambda b: b.created_at) if candidatos else None

    def listar(self) -> list[BannerHomepageRegisto]:
        return sorted(self._banners, key=lambda b: b.created_at, reverse=True)

    def criar(self, titulo: str, descricao: str | None, link: str | None, ativo: bool) -> BannerHomepageRegisto:
        registo = BannerHomepageRegisto(
            id=f"banner-{self._proximo}",
            titulo=titulo,
            descricao=descricao,
            link=link,
            imagem_url=None,
            ativo=ativo,
            created_at=datetime.now(UTC),
        )
        self._proximo += 1
        self._banners.append(registo)
        return registo

    def atualizar(self, banner_id: str, patch: BannerHomepagePatch) -> BannerHomepageRegisto | None:
        for i, b in enumerate(self._banners):
            if b.id == banner_id:
                mudancas = {k: v for k, v in patch.__dict__.items() if v is not None}
                self._banners[i] = BannerHomepageRegisto(**{**b.__dict__, **mudancas})
                return self._banners[i]
        return None

    def apagar(self, banner_id: str) -> bool:
        antes = len(self._banners)
        self._banners = [b for b in self._banners if b.id != banner_id]
        return len(self._banners) < antes

    def definir_imagem_url(self, banner_id: str, url: str) -> None:
        for i, b in enumerate(self._banners):
            if b.id == banner_id:
                self._banners[i] = BannerHomepageRegisto(**{**b.__dict__, "imagem_url": url})


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
    repo_banners = RepositorioBannerHomepageFalso()
    presigner = PresignerFalso()
    token_admin = _seed(repo_auth, "id-admin", "admin")
    token_comum = _seed(repo_auth, "id-comum", "comum")
    app.dependency_overrides[obter_auth_service] = lambda: AuthService(repo_auth)
    app.dependency_overrides[banner_homepage_router.obter_banner_homepage_repository] = lambda: repo_banners
    app.dependency_overrides[banner_homepage_router.obter_banner_homepage_upload_service] = (
        lambda: BannerHomepageUploadService(presigner, repo_banners)
    )
    with TestClient(app) as c:
        yield c, repo_banners, token_admin, token_comum
    app.dependency_overrides.clear()


# --- Leitura pública ---------------------------------------------------------


def test_sem_banner_ativo_devolve_null(ambiente) -> None:
    c, *_ = ambiente
    resposta = c.get("/banners-homepage/ativo")
    assert resposta.status_code == 200
    assert resposta.json() is None


def test_banner_ativo_sem_imagem_nao_aparece_ao_publico(ambiente) -> None:
    # Regra que o utilizador podia "mentir" ao ler directo da BD: um banner
    # marcado `ativo` mas ainda sem foto não devia aparecer na homepage.
    c, repo, *_ = ambiente
    repo.criar("Campanha", "texto", None, True)
    resposta = c.get("/banners-homepage/ativo")
    assert resposta.status_code == 200
    assert resposta.json() is None


def test_devolve_o_banner_ativo_com_imagem(ambiente) -> None:
    c, repo, *_ = ambiente
    banner = repo.criar("Campanha", "texto", None, True)
    repo.definir_imagem_url(banner.id, "https://cdn.exemplo.test/banners-homepage/x.png")

    resposta = c.get("/banners-homepage/ativo")
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["titulo"] == "Campanha"
    assert corpo["imagem_url"] == "https://cdn.exemplo.test/banners-homepage/x.png"
    assert "ativo" not in corpo  # BannerHomepagePublico não expõe `ativo`


# --- Gestão exige admin ----------------------------------------------------


def test_listar_sem_sessao_devolve_401(ambiente) -> None:
    c, *_ = ambiente
    assert c.get("/banners-homepage").status_code == 401


def test_criar_com_papel_comum_devolve_403(ambiente) -> None:
    c, _, _, token_comum = ambiente
    c.cookies.set("access_token", token_comum)
    resposta = c.post("/banners-homepage", json={"titulo": "X"})
    assert resposta.status_code == 403


def test_admin_cria_lista_e_apaga(ambiente) -> None:
    c, _, token, _ = ambiente
    c.cookies.set("access_token", token)

    criado = c.post("/banners-homepage", json={"titulo": "Campanha", "descricao": "Doe já", "link": "/apoiar"})
    assert criado.status_code == 201
    corpo = criado.json()
    assert corpo["titulo"] == "Campanha"
    assert corpo["ativo"] is False  # nasce inativo por omissão
    assert corpo["imagem_url"] is None
    banner_id = corpo["id"]

    listagem = c.get("/banners-homepage")
    assert listagem.status_code == 200
    assert [b["id"] for b in listagem.json()] == [banner_id]

    apagado = c.request("DELETE", f"/banners-homepage/{banner_id}")
    assert apagado.status_code == 204
    assert c.get("/banners-homepage").json() == []


def test_patch_de_banner_inexistente_devolve_404(ambiente) -> None:
    c, _, token, _ = ambiente
    c.cookies.set("access_token", token)
    resposta = c.patch("/banners-homepage/banner-999", json={"titulo": "Novo"})
    assert resposta.status_code == 404


def test_delete_de_banner_inexistente_devolve_404(ambiente) -> None:
    c, _, token, _ = ambiente
    c.cookies.set("access_token", token)
    assert c.request("DELETE", "/banners-homepage/banner-999").status_code == 404


# --- Upload da imagem -------------------------------------------------------


def test_preparar_imagem_sem_sessao_devolve_401(ambiente) -> None:
    c, repo, *_ = ambiente
    banner_id = repo.criar("Campanha", None, None, False).id
    resposta = c.post(f"/banners-homepage/{banner_id}/imagem/preparar", json={"content_type": "image/png"})
    assert resposta.status_code == 401


def test_preparar_imagem_tipo_invalido_devolve_422(ambiente) -> None:
    c, repo, token, _ = ambiente
    c.cookies.set("access_token", token)
    banner_id = repo.criar("Campanha", None, None, False).id
    resposta = c.post(
        f"/banners-homepage/{banner_id}/imagem/preparar", json={"content_type": "application/pdf"}
    )
    assert resposta.status_code == 422


def test_preparar_e_confirmar_imagem(ambiente) -> None:
    c, repo, token, _ = ambiente
    c.cookies.set("access_token", token)
    banner_id = repo.criar("Campanha", None, None, False).id

    preparado = c.post(f"/banners-homepage/{banner_id}/imagem/preparar", json={"content_type": "image/png"})
    assert preparado.status_code == 200
    chave = preparado.json()["chave"]
    assert chave.startswith(f"banners-homepage/{banner_id}/")

    confirmado = c.post(f"/banners-homepage/{banner_id}/imagem/confirmar", json={"chave": chave})
    assert confirmado.status_code == 200
    assert confirmado.json()["imagem_url"] == preparado.json()["url_publico"]
    assert repo.obter_ativo() is None  # continua inactivo, só ganhou a foto


def test_confirmar_chave_de_outro_banner_devolve_403(ambiente) -> None:
    c, repo, token, _ = ambiente
    c.cookies.set("access_token", token)
    banner_id = repo.criar("Campanha", None, None, False).id

    resposta = c.post(
        f"/banners-homepage/{banner_id}/imagem/confirmar",
        json={"chave": "banners-homepage/outro-banner/x.png"},
    )
    assert resposta.status_code == 403
