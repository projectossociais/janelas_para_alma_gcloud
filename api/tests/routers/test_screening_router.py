"""Testes do router de screenings — fronteira de autorização (CLAUDE.md
secção 4.1: nunca confiar num id do pedido para decidir acesso a dados de
outra pessoa) e o caminho de erro de validação (nunca 201 com landmarks
mal formados)."""

from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.core.dependencies import obter_auth_service
from app.core.security import criar_access_token, hash_password
from app.main import app
from app.repositories.screening_repository import ScreeningCalculado, ScreeningRegisto
from app.repositories.utilizadores_repository import UtilizadorRegisto
from app.routers import screening as screening_router
from app.services.auth_service import AuthService
from tests.services.test_auth_service import RepositorioFalso as RepositorioAuthFalso

_LANDMARKS_SIMETRICOS = [{"x": 0.0, "y": 0.0}] * 480
for _i, (_x, _y) in {
    33: (0.30, 0.50), 133: (0.40, 0.50), 159: (0.35, 0.48), 145: (0.35, 0.52), 468: (0.35, 0.50),
    362: (0.70, 0.50), 263: (0.60, 0.50), 386: (0.65, 0.48), 374: (0.65, 0.52), 473: (0.65, 0.50),
}.items():
    _LANDMARKS_SIMETRICOS[_i] = {"x": _x, "y": _y}


def _corpo_valido() -> dict:
    return {
        "poses": [
            {"pose": "center", "landmarks": _LANDMARKS_SIMETRICOS},
            {"pose": "right", "landmarks": _LANDMARKS_SIMETRICOS},
            {"pose": "left", "landmarks": _LANDMARKS_SIMETRICOS},
        ],
        "ambiente_escuro_em_algum_momento": False,
    }


class RepositorioScreeningFalso:
    def __init__(self) -> None:
        self._linhas: dict[str, ScreeningRegisto] = {}
        self._seq = 0

    def criar(self, user_id: str, calculado: ScreeningCalculado) -> ScreeningRegisto:
        self._seq += 1
        registo = ScreeningRegisto(
            id=f"screening-{self._seq}",
            user_id=user_id,
            estado=calculado.estado,
            rosto_detetado=calculado.rosto_detetado,
            requer_avaliacao_humana=calculado.requer_avaliacao_humana,
            assimetria_horizontal=calculado.assimetria_horizontal,
            assimetria_vertical=calculado.assimetria_vertical,
            qualidade_captura=calculado.qualidade_captura,
            qualidade_fiavel=calculado.qualidade_fiavel,
            qualidade_motivos=calculado.qualidade_motivos,
            versao_analise="geometria-iris-v1-experimental",
            criado_em=datetime.now(UTC),
        )
        self._linhas[registo.id] = registo
        return registo

    def obter(self, screening_id: str) -> ScreeningRegisto | None:
        return self._linhas.get(screening_id)


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
    repo_screening = RepositorioScreeningFalso()
    token_dono = _seed(repo_auth, "id-dono", "comum")
    token_outro = _seed(repo_auth, "id-outro", "comum")
    token_admin = _seed(repo_auth, "id-admin", "admin")
    app.dependency_overrides[obter_auth_service] = lambda: AuthService(repo_auth)
    app.dependency_overrides[screening_router.obter_screening_repository] = lambda: repo_screening
    with TestClient(app) as c:
        yield c, repo_screening, token_dono, token_outro, token_admin
    app.dependency_overrides.clear()


# --- criar --------------------------------------------------------------


def test_criar_sem_sessao_401(ambiente) -> None:
    c, *_ = ambiente
    assert c.post("/screenings", json=_corpo_valido()).status_code == 401


def test_criar_com_sessao_devolve_201_e_calcula_a_partir_dos_landmarks(ambiente) -> None:
    c, repo, token_dono, _, _ = ambiente
    c.cookies.set("access_token", token_dono)

    r = c.post("/screenings", json=_corpo_valido())

    assert r.status_code == 201
    corpo = r.json()
    assert corpo["user_id"] == "id-dono"
    assert corpo["estado"] == "concluido"
    assert corpo["requer_avaliacao_humana"] is True
    assert abs(corpo["assimetria_horizontal"]) < 1e-6
    assert repo.obter(corpo["id"]) is not None


def test_user_id_vem_sempre_do_jwt_o_schema_nem_tem_esse_campo(ambiente) -> None:
    c, _, token_dono, _, _ = ambiente
    c.cookies.set("access_token", token_dono)

    corpo_forjado = _corpo_valido()
    corpo_forjado["user_id"] = "00000000-0000-0000-0000-000000000000"
    r = c.post("/screenings", json=corpo_forjado)

    assert r.status_code == 201
    assert r.json()["user_id"] == "id-dono"


def test_sem_nenhuma_pose_e_422(ambiente) -> None:
    c, _, token_dono, _, _ = ambiente
    c.cookies.set("access_token", token_dono)
    assert c.post("/screenings", json={"poses": []}).status_code == 422


def test_mais_de_3_poses_e_422(ambiente) -> None:
    c, _, token_dono, _, _ = ambiente
    c.cookies.set("access_token", token_dono)
    corpo = _corpo_valido()
    corpo["poses"].append({"pose": "center", "landmarks": []})
    assert c.post("/screenings", json=corpo).status_code == 422


def test_rosto_nao_detetado_ainda_devolve_201_honesto_sobre_o_estado(ambiente) -> None:
    c, _, token_dono, _, _ = ambiente
    c.cookies.set("access_token", token_dono)

    r = c.post("/screenings", json={"poses": [{"pose": "center", "landmarks": []}]})

    assert r.status_code == 201
    corpo = r.json()
    assert corpo["estado"] == "sem_deteccao"
    assert corpo["assimetria_horizontal"] is None
    assert corpo["qualidade_fiavel"] is False


# --- obter: só o dono ou um admin ----------------------------------------


def test_obter_sem_sessao_401(ambiente) -> None:
    c, _, token_dono, _, _ = ambiente
    c.cookies.set("access_token", token_dono)
    screening_id = c.post("/screenings", json=_corpo_valido()).json()["id"]
    c.cookies.clear()

    assert c.get(f"/screenings/{screening_id}").status_code == 401


def test_obter_pelo_dono_200(ambiente) -> None:
    c, _, token_dono, _, _ = ambiente
    c.cookies.set("access_token", token_dono)
    screening_id = c.post("/screenings", json=_corpo_valido()).json()["id"]

    assert c.get(f"/screenings/{screening_id}").status_code == 200


def test_obter_por_outro_utilizador_403(ambiente) -> None:
    c, _, token_dono, token_outro, _ = ambiente
    c.cookies.set("access_token", token_dono)
    screening_id = c.post("/screenings", json=_corpo_valido()).json()["id"]

    c.cookies.set("access_token", token_outro)
    assert c.get(f"/screenings/{screening_id}").status_code == 403


def test_obter_por_admin_200(ambiente) -> None:
    c, _, token_dono, _, token_admin = ambiente
    c.cookies.set("access_token", token_dono)
    screening_id = c.post("/screenings", json=_corpo_valido()).json()["id"]

    c.cookies.set("access_token", token_admin)
    assert c.get(f"/screenings/{screening_id}").status_code == 200


def test_obter_inexistente_404(ambiente) -> None:
    c, _, token_dono, _, _ = ambiente
    c.cookies.set("access_token", token_dono)
    assert c.get("/screenings/screening-999").status_code == 404
