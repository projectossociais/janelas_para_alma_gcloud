from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.core.dependencies import (
    obter_auth_service,
    obter_clinica_parceira_repository,
    obter_equipa_clinica_repository,
)
from app.core.security import criar_access_token, hash_password
from app.main import app
from app.repositories.agendamento_clinico_repository import AgendamentoClinicoRegisto
from app.repositories.clinica_parceira_repository import ClinicaParceiraRegisto
from app.repositories.utilizadores_repository import UtilizadorRegisto
from app.routers import agendamentos as agendamentos_router
from app.routers import clinicas as clinicas_router
from app.services.auth_service import AuthService
from app.services.equipa_clinica_service import EquipaClinicaService
from tests.services.test_auth_service import RepositorioFalso as RepositorioAuthFalso
from tests.services.test_equipa_clinica_service import RepositorioEquipaFalso


class RepositorioClinicasFalso:
    def __init__(self) -> None:
        self._clinicas = {
            "clinica-1": ClinicaParceiraRegisto(
                id="clinica-1",
                nome="Óptica Optioptika",
                email_contacto="geral@optioptika.com",
                telefone_contacto="+244931240304",
                ativa=True,
                especialidades=[],
                cidade="Luanda",
                modalidades_suportadas=["presencial", "online"],
                preco_indicativo=None,
                created_at=datetime.now(UTC),
            )
        }

    def listar_ativas(self):
        return [c for c in self._clinicas.values() if c.ativa]

    def listar_todas(self):
        return list(self._clinicas.values())

    def obter(self, clinica_id: str):
        return self._clinicas.get(clinica_id)

    def atualizar_perfil(self, clinica_id, especialidades, cidade, modalidades_suportadas, preco_indicativo):
        atual = self._clinicas.get(clinica_id)
        if atual is None:
            return None
        novo = ClinicaParceiraRegisto(
            **{
                **atual.__dict__,
                "especialidades": especialidades,
                "cidade": cidade,
                "modalidades_suportadas": modalidades_suportadas,
                "preco_indicativo": preco_indicativo,
            }
        )
        self._clinicas[clinica_id] = novo
        return novo


class RepositorioAgendamentosFalso:
    def __init__(self) -> None:
        self._agendamentos: list[AgendamentoClinicoRegisto] = []

    def seed(self, **over):
        base = {
            "id": f"ag-{len(self._agendamentos) + 1}",
            "clinica_id": "clinica-1",
            "utilizador_id": None,
            "screening_id": None,
            "nome": "Ana Silva",
            "email": "ana@example.com",
            "telefone": "+244900000000",
            "modalidade": "presencial",
            "data_preferida": None,
            "periodo_preferido": None,
            "motivo": None,
            "estado": "pendente",
            "decidido_por": None,
            "decidido_em": None,
            "created_at": datetime.now(UTC),
        }
        base.update(over)
        self._agendamentos.append(AgendamentoClinicoRegisto(**base))

    def criar(self, **kwargs):  # pragma: no cover
        raise NotImplementedError

    def obter(self, agendamento_id: str):  # pragma: no cover
        raise NotImplementedError

    def listar(self) -> list[AgendamentoClinicoRegisto]:
        return list(self._agendamentos)

    def confirmar(self, *a, **k):  # pragma: no cover
        raise NotImplementedError

    def recusar(self, *a, **k):  # pragma: no cover
        raise NotImplementedError


def _seed_utilizador(repo_auth: RepositorioAuthFalso, id_: str, email: str, papel: str) -> str:
    repo_auth._utilizadores[email] = UtilizadorRegisto(
        id=id_,
        email=email,
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
    repo_clinicas = RepositorioClinicasFalso()
    repo_equipa = RepositorioEquipaFalso()
    repo_agendamentos = RepositorioAgendamentosFalso()

    token_admin = _seed_utilizador(repo_auth, "id-admin", "admin@example.com", "admin")
    token_medico = _seed_utilizador(repo_auth, "id-medico", "dr.ana@optioptika.com", "profissional")
    token_comum = _seed_utilizador(repo_auth, "id-comum", "comum@example.com", "comum")

    app.dependency_overrides[obter_auth_service] = lambda: AuthService(repo_auth)
    app.dependency_overrides[obter_clinica_parceira_repository] = lambda: repo_clinicas
    app.dependency_overrides[obter_equipa_clinica_repository] = lambda: repo_equipa
    app.dependency_overrides[clinicas_router.obter_agendamento_clinico_repository] = lambda: repo_agendamentos
    app.dependency_overrides[agendamentos_router.obter_clinica_parceira_repository] = lambda: repo_clinicas
    app.dependency_overrides[clinicas_router.obter_equipa_clinica_service] = (
        lambda: EquipaClinicaService(repo_equipa, repo_clinicas, repo_auth)
    )
    with TestClient(app) as c:
        yield c, repo_equipa, repo_agendamentos, token_admin, token_medico, token_comum
    app.dependency_overrides.clear()


# --- /clinica/eu -------------------------------------------------------------


def test_a_minha_clinica_sem_ligacao_devolve_null(ambiente) -> None:
    c, _, _, _, _, token_comum = ambiente
    c.cookies.set("access_token", token_comum)
    resposta = c.get("/clinica/eu")
    assert resposta.status_code == 200
    assert resposta.json() is None


def test_a_minha_clinica_com_ligacao(ambiente) -> None:
    c, repo_equipa, _, _, token_medico, _ = ambiente
    repo_equipa.criar("id-medico", "clinica-1")
    c.cookies.set("access_token", token_medico)

    resposta = c.get("/clinica/eu")

    assert resposta.status_code == 200
    assert resposta.json()["nome"] == "Óptica Optioptika"


def test_a_minha_clinica_sem_sessao_401(ambiente) -> None:
    c, *_ = ambiente
    assert c.get("/clinica/eu").status_code == 401


# --- /clinica/agendamentos ----------------------------------------------------


def test_meus_agendamentos_sem_ligacao_devolve_403(ambiente) -> None:
    c, _, _, _, _, token_comum = ambiente
    c.cookies.set("access_token", token_comum)
    assert c.get("/clinica/agendamentos").status_code == 403


def test_meus_agendamentos_filtra_pela_propria_clinica(ambiente) -> None:
    c, repo_equipa, repo_agendamentos, _, token_medico, _ = ambiente
    repo_equipa.criar("id-medico", "clinica-1")
    repo_agendamentos.seed(clinica_id="clinica-1", nome="Paciente da minha clínica")
    repo_agendamentos.seed(clinica_id="outra-clinica", nome="Paciente de outra clínica")
    c.cookies.set("access_token", token_medico)

    resposta = c.get("/clinica/agendamentos")

    assert resposta.status_code == 200
    nomes = [a["nome"] for a in resposta.json()]
    assert nomes == ["Paciente da minha clínica"]


# --- administração -------------------------------------------------------------


def test_listar_clinicas_admin_exige_admin(ambiente) -> None:
    c, _, _, _, _, token_comum = ambiente
    c.cookies.set("access_token", token_comum)
    assert c.get("/admin/clinicas").status_code == 403


def test_atualizar_perfil_da_clinica(ambiente) -> None:
    c, *_ , token_admin, _, _ = ambiente
    c.cookies.set("access_token", token_admin)

    resposta = c.patch(
        "/admin/clinicas/clinica-1",
        json={
            "especialidades": ["oftalmologia pediátrica"],
            "cidade": "Luanda",
            "modalidades_suportadas": ["presencial"],
            "preco_indicativo": "a partir de 15.000 Kz",
        },
    )

    assert resposta.status_code == 200
    assert resposta.json()["especialidades"] == ["oftalmologia pediátrica"]


def test_adicionar_membro_por_email(ambiente) -> None:
    c, repo_equipa, _, token_admin, *_ = ambiente
    c.cookies.set("access_token", token_admin)

    resposta = c.post("/admin/clinicas/clinica-1/equipa", json={"email": "dr.ana@optioptika.com"})

    assert resposta.status_code == 201
    assert repo_equipa.obter_por_utilizador("id-medico") is not None


def test_adicionar_membro_com_email_inexistente_404(ambiente) -> None:
    c, _, _, token_admin, *_ = ambiente
    c.cookies.set("access_token", token_admin)

    resposta = c.post("/admin/clinicas/clinica-1/equipa", json={"email": "ninguem@example.com"})

    assert resposta.status_code == 404


def test_adicionar_membro_exige_admin(ambiente) -> None:
    c, _, _, _, _, token_comum = ambiente
    c.cookies.set("access_token", token_comum)
    resposta = c.post("/admin/clinicas/clinica-1/equipa", json={"email": "dr.ana@optioptika.com"})
    assert resposta.status_code == 403


def test_remover_membro(ambiente) -> None:
    c, repo_equipa, _, token_admin, *_ = ambiente
    repo_equipa.criar("id-medico", "clinica-1")
    c.cookies.set("access_token", token_admin)

    resposta = c.delete("/admin/clinicas/clinica-1/equipa/id-medico")

    assert resposta.status_code == 204
    assert repo_equipa.obter_por_utilizador("id-medico") is None


def test_remover_membro_inexistente_404(ambiente) -> None:
    c, _, _, token_admin, *_ = ambiente
    c.cookies.set("access_token", token_admin)
    resposta = c.delete("/admin/clinicas/clinica-1/equipa/nao-ligado")
    assert resposta.status_code == 404
