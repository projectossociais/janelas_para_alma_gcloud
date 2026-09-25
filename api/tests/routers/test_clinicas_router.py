import uuid
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.core.dependencies import (
    obter_auth_service,
    obter_clinica_parceira_repository,
    obter_disponibilidade_clinica_repository,
    obter_equipa_clinica_repository,
    obter_teleconsulta_repository,
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
            "horario_inicio": None,
            "motivo": None,
            "estado": "pendente",
            "decidido_por": None,
            "decidido_em": None,
            "created_at": datetime.now(UTC),
        }
        base.update(over)
        registo = AgendamentoClinicoRegisto(**base)
        self._agendamentos.append(registo)
        return registo

    def criar(self, **kwargs):  # pragma: no cover
        raise NotImplementedError

    def obter(self, agendamento_id: str):
        return next((a for a in self._agendamentos if a.id == agendamento_id), None)

    def listar(self) -> list[AgendamentoClinicoRegisto]:
        return list(self._agendamentos)

    def confirmar(self, *a, **k):  # pragma: no cover
        raise NotImplementedError

    def recusar(self, *a, **k):  # pragma: no cover
        raise NotImplementedError


class RepositorioDisponibilidadeFalso:
    def __init__(self) -> None:
        self._janelas: dict[str, dict] = {}

    def criar(self, clinica_id, dia_semana, hora_inicio, hora_fim, modalidade):
        disponibilidade_id = str(uuid.uuid4())
        registo = {
            "id": disponibilidade_id,
            "clinica_id": clinica_id,
            "dia_semana": dia_semana,
            "hora_inicio": hora_inicio,
            "hora_fim": hora_fim,
            "modalidade": modalidade,
            "created_at": datetime.now(UTC),
        }
        self._janelas[disponibilidade_id] = registo
        return _RegistoSimples(**registo)

    def listar_por_clinica(self, clinica_id):
        return [_RegistoSimples(**r) for r in self._janelas.values() if r["clinica_id"] == clinica_id]

    def remover(self, disponibilidade_id, clinica_id) -> bool:
        atual = self._janelas.get(disponibilidade_id)
        if atual is None or atual["clinica_id"] != clinica_id:
            return False
        del self._janelas[disponibilidade_id]
        return True


class _RegistoSimples:
    def __init__(self, **kwargs) -> None:
        self.__dict__.update(kwargs)


class RepositorioTeleconsultaFalso:
    def __init__(self) -> None:
        self._por_agendamento: dict[str, dict] = {}

    def seed(self, agendamento_id: str, **over):
        base = {
            "id": f"tele-{agendamento_id}",
            "agendamento_id": agendamento_id,
            "sala_video": "janelas-para-alma-teste",
            "estado": "agendada",
            "iniciada_em": None,
            "concluida_em": None,
            "recomendacao_clinica": None,
            "created_at": datetime.now(UTC),
        }
        base.update(over)
        self._por_agendamento[agendamento_id] = base

    def criar(self, agendamento_id: str, sala_video: str):  # pragma: no cover
        raise NotImplementedError

    def obter_por_agendamento(self, agendamento_id: str):
        registo = self._por_agendamento.get(agendamento_id)
        return _RegistoSimples(**registo) if registo else None

    def iniciar(self, teleconsulta_id: str, quando):
        for registo in self._por_agendamento.values():
            if registo["id"] == teleconsulta_id:
                registo["estado"] = "em_curso"
                registo["iniciada_em"] = quando
                return _RegistoSimples(**registo)
        raise KeyError(teleconsulta_id)  # pragma: no cover

    def concluir(self, teleconsulta_id: str, quando, recomendacao_clinica: str):
        for registo in self._por_agendamento.values():
            if registo["id"] == teleconsulta_id:
                registo["estado"] = "concluida"
                registo["concluida_em"] = quando
                registo["recomendacao_clinica"] = recomendacao_clinica
                return _RegistoSimples(**registo)
        raise KeyError(teleconsulta_id)  # pragma: no cover


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
    repo_disponibilidade = RepositorioDisponibilidadeFalso()
    repo_teleconsulta = RepositorioTeleconsultaFalso()

    token_admin = _seed_utilizador(repo_auth, "id-admin", "admin@example.com", "admin")
    token_medico = _seed_utilizador(repo_auth, "id-medico", "dr.ana@optioptika.com", "profissional")
    token_comum = _seed_utilizador(repo_auth, "id-comum", "comum@example.com", "comum")

    app.dependency_overrides[obter_auth_service] = lambda: AuthService(repo_auth)
    app.dependency_overrides[obter_clinica_parceira_repository] = lambda: repo_clinicas
    app.dependency_overrides[obter_equipa_clinica_repository] = lambda: repo_equipa
    app.dependency_overrides[obter_disponibilidade_clinica_repository] = lambda: repo_disponibilidade
    app.dependency_overrides[obter_teleconsulta_repository] = lambda: repo_teleconsulta
    app.dependency_overrides[clinicas_router.obter_agendamento_clinico_repository] = lambda: repo_agendamentos
    app.dependency_overrides[agendamentos_router.obter_clinica_parceira_repository] = lambda: repo_clinicas
    app.dependency_overrides[clinicas_router.obter_equipa_clinica_service] = (
        lambda: EquipaClinicaService(repo_equipa, repo_clinicas, repo_auth)
    )
    with TestClient(app) as c:
        yield c, repo_equipa, repo_agendamentos, repo_teleconsulta, token_admin, token_medico, token_comum
    app.dependency_overrides.clear()


# --- /clinica/eu -------------------------------------------------------------


def test_a_minha_clinica_sem_ligacao_devolve_null(ambiente) -> None:
    c, _, _, _, _, _, token_comum = ambiente
    c.cookies.set("access_token", token_comum)
    resposta = c.get("/clinica/eu")
    assert resposta.status_code == 200
    assert resposta.json() is None


def test_a_minha_clinica_com_ligacao(ambiente) -> None:
    c, repo_equipa, _, _, _, token_medico, _ = ambiente
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
    c, _, _, _, _, _, token_comum = ambiente
    c.cookies.set("access_token", token_comum)
    assert c.get("/clinica/agendamentos").status_code == 403


def test_meus_agendamentos_filtra_pela_propria_clinica(ambiente) -> None:
    c, repo_equipa, repo_agendamentos, _, _, token_medico, _ = ambiente
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
    c, _, _, _, _, _, token_comum = ambiente
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
    c, repo_equipa, _, _, token_admin, *_ = ambiente
    c.cookies.set("access_token", token_admin)

    resposta = c.post("/admin/clinicas/clinica-1/equipa", json={"email": "dr.ana@optioptika.com"})

    assert resposta.status_code == 201
    assert repo_equipa.obter_por_utilizador("id-medico") is not None


def test_adicionar_membro_com_email_inexistente_404(ambiente) -> None:
    c, _, _, _, token_admin, *_ = ambiente
    c.cookies.set("access_token", token_admin)

    resposta = c.post("/admin/clinicas/clinica-1/equipa", json={"email": "ninguem@example.com"})

    assert resposta.status_code == 404


def test_adicionar_membro_exige_admin(ambiente) -> None:
    c, _, _, _, _, _, token_comum = ambiente
    c.cookies.set("access_token", token_comum)
    resposta = c.post("/admin/clinicas/clinica-1/equipa", json={"email": "dr.ana@optioptika.com"})
    assert resposta.status_code == 403


def test_remover_membro(ambiente) -> None:
    c, repo_equipa, _, _, token_admin, *_ = ambiente
    repo_equipa.criar("id-medico", "clinica-1")
    c.cookies.set("access_token", token_admin)

    resposta = c.delete("/admin/clinicas/clinica-1/equipa/id-medico")

    assert resposta.status_code == 204
    assert repo_equipa.obter_por_utilizador("id-medico") is None


def test_remover_membro_inexistente_404(ambiente) -> None:
    c, _, _, _, token_admin, *_ = ambiente
    c.cookies.set("access_token", token_admin)
    resposta = c.delete("/admin/clinicas/clinica-1/equipa/nao-ligado")
    assert resposta.status_code == 404


# --- /clinica/disponibilidade --------------------------------------------------

_JANELA_VALIDA = {
    "dia_semana": 0,
    "hora_inicio": "08:00:00",
    "hora_fim": "12:00:00",
    "modalidade": "presencial",
}


def test_listar_disponibilidade_sem_ligacao_devolve_403(ambiente) -> None:
    c, _, _, _, _, _, token_comum = ambiente
    c.cookies.set("access_token", token_comum)
    assert c.get("/clinica/disponibilidade").status_code == 403


def test_adicionar_disponibilidade_liga_a_propria_clinica(ambiente) -> None:
    c, repo_equipa, *_ , token_medico, _ = ambiente
    repo_equipa.criar("id-medico", "clinica-1")
    c.cookies.set("access_token", token_medico)

    resposta = c.post("/clinica/disponibilidade", json=_JANELA_VALIDA)

    assert resposta.status_code == 201
    corpo = resposta.json()
    assert corpo["clinica_id"] == "clinica-1"
    assert corpo["dia_semana"] == 0


def test_adicionar_disponibilidade_sem_ligacao_devolve_403(ambiente) -> None:
    c, _, _, _, _, _, token_comum = ambiente
    c.cookies.set("access_token", token_comum)
    resposta = c.post("/clinica/disponibilidade", json=_JANELA_VALIDA)
    assert resposta.status_code == 403


def test_adicionar_disponibilidade_hora_fim_antes_de_inicio_422(ambiente) -> None:
    c, repo_equipa, *_ , token_medico, _ = ambiente
    repo_equipa.criar("id-medico", "clinica-1")
    c.cookies.set("access_token", token_medico)

    resposta = c.post(
        "/clinica/disponibilidade", json={**_JANELA_VALIDA, "hora_inicio": "12:00:00", "hora_fim": "08:00:00"}
    )

    assert resposta.status_code == 422


def test_listar_disponibilidade_devolve_as_da_propria_clinica(ambiente) -> None:
    c, repo_equipa, *_ , token_medico, _ = ambiente
    repo_equipa.criar("id-medico", "clinica-1")
    c.cookies.set("access_token", token_medico)
    c.post("/clinica/disponibilidade", json=_JANELA_VALIDA)

    resposta = c.get("/clinica/disponibilidade")

    assert resposta.status_code == 200
    assert len(resposta.json()) == 1


def test_remover_disponibilidade_da_propria_clinica(ambiente) -> None:
    c, repo_equipa, *_ , token_medico, _ = ambiente
    repo_equipa.criar("id-medico", "clinica-1")
    c.cookies.set("access_token", token_medico)
    criada = c.post("/clinica/disponibilidade", json=_JANELA_VALIDA).json()

    resposta = c.delete(f"/clinica/disponibilidade/{criada['id']}")

    assert resposta.status_code == 204
    assert c.get("/clinica/disponibilidade").json() == []


def test_remover_disponibilidade_inexistente_404(ambiente) -> None:
    c, repo_equipa, *_ , token_medico, _ = ambiente
    repo_equipa.criar("id-medico", "clinica-1")
    c.cookies.set("access_token", token_medico)

    resposta = c.delete("/clinica/disponibilidade/nao-existe")

    assert resposta.status_code == 404


# --- /clinica/teleconsultas ---------------------------------------------------


def test_obter_teleconsulta_da_propria_clinica(ambiente) -> None:
    c, repo_equipa, repo_agendamentos, repo_teleconsulta, _, token_medico, _ = ambiente
    repo_equipa.criar("id-medico", "clinica-1")
    ag = repo_agendamentos.seed(clinica_id="clinica-1", modalidade="online")
    repo_teleconsulta.seed(ag.id)
    c.cookies.set("access_token", token_medico)

    resposta = c.get(f"/clinica/teleconsultas/{ag.id}")

    assert resposta.status_code == 200
    assert resposta.json()["estado"] == "agendada"


def test_obter_teleconsulta_de_outra_clinica_403(ambiente) -> None:
    c, repo_equipa, repo_agendamentos, repo_teleconsulta, _, token_medico, _ = ambiente
    repo_equipa.criar("id-medico", "clinica-1")
    ag = repo_agendamentos.seed(clinica_id="outra-clinica", modalidade="online")
    repo_teleconsulta.seed(ag.id)
    c.cookies.set("access_token", token_medico)

    resposta = c.get(f"/clinica/teleconsultas/{ag.id}")

    assert resposta.status_code == 403


def test_obter_teleconsulta_de_agendamento_presencial_404(ambiente) -> None:
    c, repo_equipa, repo_agendamentos, _, _, token_medico, _ = ambiente
    repo_equipa.criar("id-medico", "clinica-1")
    ag = repo_agendamentos.seed(clinica_id="clinica-1", modalidade="presencial")
    c.cookies.set("access_token", token_medico)

    resposta = c.get(f"/clinica/teleconsultas/{ag.id}")

    assert resposta.status_code == 404


def test_iniciar_teleconsulta(ambiente) -> None:
    c, repo_equipa, repo_agendamentos, repo_teleconsulta, _, token_medico, _ = ambiente
    repo_equipa.criar("id-medico", "clinica-1")
    ag = repo_agendamentos.seed(clinica_id="clinica-1", modalidade="online")
    repo_teleconsulta.seed(ag.id)
    c.cookies.set("access_token", token_medico)

    resposta = c.post(f"/clinica/teleconsultas/{ag.id}/iniciar")

    assert resposta.status_code == 200
    assert resposta.json()["estado"] == "em_curso"


def test_iniciar_teleconsulta_ja_iniciada_409(ambiente) -> None:
    c, repo_equipa, repo_agendamentos, repo_teleconsulta, _, token_medico, _ = ambiente
    repo_equipa.criar("id-medico", "clinica-1")
    ag = repo_agendamentos.seed(clinica_id="clinica-1", modalidade="online")
    repo_teleconsulta.seed(ag.id, estado="em_curso")
    c.cookies.set("access_token", token_medico)

    resposta = c.post(f"/clinica/teleconsultas/{ag.id}/iniciar")

    assert resposta.status_code == 409


def test_iniciar_teleconsulta_de_outra_clinica_403(ambiente) -> None:
    c, repo_equipa, repo_agendamentos, repo_teleconsulta, _, token_medico, _ = ambiente
    repo_equipa.criar("id-medico", "clinica-1")
    ag = repo_agendamentos.seed(clinica_id="outra-clinica", modalidade="online")
    repo_teleconsulta.seed(ag.id)
    c.cookies.set("access_token", token_medico)

    resposta = c.post(f"/clinica/teleconsultas/{ag.id}/iniciar")

    assert resposta.status_code == 403


def test_concluir_teleconsulta_grava_recomendacao(ambiente) -> None:
    c, repo_equipa, repo_agendamentos, repo_teleconsulta, _, token_medico, _ = ambiente
    repo_equipa.criar("id-medico", "clinica-1")
    ag = repo_agendamentos.seed(clinica_id="clinica-1", modalidade="online")
    repo_teleconsulta.seed(ag.id, estado="em_curso")
    c.cookies.set("access_token", token_medico)

    resposta = c.post(
        f"/clinica/teleconsultas/{ag.id}/concluir", json={"recomendacao_clinica": "Usar óculos com grau X."}
    )

    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["estado"] == "concluida"
    assert corpo["recomendacao_clinica"] == "Usar óculos com grau X."


def test_concluir_teleconsulta_sem_ter_iniciado_409(ambiente) -> None:
    c, repo_equipa, repo_agendamentos, repo_teleconsulta, _, token_medico, _ = ambiente
    repo_equipa.criar("id-medico", "clinica-1")
    ag = repo_agendamentos.seed(clinica_id="clinica-1", modalidade="online")
    repo_teleconsulta.seed(ag.id, estado="agendada")
    c.cookies.set("access_token", token_medico)

    resposta = c.post(f"/clinica/teleconsultas/{ag.id}/concluir", json={"recomendacao_clinica": "Usar óculos."})

    assert resposta.status_code == 409


def test_concluir_teleconsulta_sem_recomendacao_422(ambiente) -> None:
    c, repo_equipa, repo_agendamentos, repo_teleconsulta, _, token_medico, _ = ambiente
    repo_equipa.criar("id-medico", "clinica-1")
    ag = repo_agendamentos.seed(clinica_id="clinica-1", modalidade="online")
    repo_teleconsulta.seed(ag.id, estado="em_curso")
    c.cookies.set("access_token", token_medico)

    resposta = c.post(f"/clinica/teleconsultas/{ag.id}/concluir", json={"recomendacao_clinica": ""})

    assert resposta.status_code == 422


def test_teleconsulta_sem_ligacao_a_clinica_403(ambiente) -> None:
    c, _, repo_agendamentos, repo_teleconsulta, _, _, token_comum = ambiente
    ag = repo_agendamentos.seed(clinica_id="clinica-1", modalidade="online")
    repo_teleconsulta.seed(ag.id)
    c.cookies.set("access_token", token_comum)

    resposta = c.get(f"/clinica/teleconsultas/{ag.id}")

    assert resposta.status_code == 403
