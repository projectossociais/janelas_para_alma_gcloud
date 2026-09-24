from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.core.dependencies import obter_auth_service
from app.core.security import criar_access_token, hash_password
from app.main import app
from app.repositories.agendamento_clinico_repository import AgendamentoClinicoRegisto
from app.repositories.clinica_parceira_repository import ClinicaParceiraRegisto
from app.repositories.utilizadores_repository import UtilizadorRegisto
from app.routers import agendamentos as agendamentos_router
from app.services.agendamento_clinico_service import AgendamentoClinicoService
from app.services.auth_service import AuthService
from tests.services.test_agendamento_clinico_service import EmailSenderFalso
from tests.services.test_auth_service import RepositorioFalso as RepositorioAuthFalso


class RepositorioAgendamentosFalso:
    def __init__(self) -> None:
        self._agendamentos: dict[str, AgendamentoClinicoRegisto] = {}
        self._seq = 0

    def _registo(self, **over) -> AgendamentoClinicoRegisto:
        base = {
            "id": "",
            "clinica_id": "",
            "utilizador_id": None,
            "screening_id": None,
            "nome": "",
            "email": "",
            "telefone": "",
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
        return AgendamentoClinicoRegisto(**base)

    def criar(self, **kwargs) -> AgendamentoClinicoRegisto:
        self._seq += 1
        agendamento_id = f"ag-{self._seq}"
        registo = self._registo(id=agendamento_id, **kwargs)
        self._agendamentos[agendamento_id] = registo
        return registo

    def obter(self, agendamento_id: str) -> AgendamentoClinicoRegisto | None:
        return self._agendamentos.get(agendamento_id)

    def listar(self) -> list[AgendamentoClinicoRegisto]:
        return list(self._agendamentos.values())

    def confirmar(self, agendamento_id: str, admin_id: str, quando) -> AgendamentoClinicoRegisto:
        atual = self._agendamentos[agendamento_id]
        novo = self._registo(**{**atual.__dict__, "estado": "confirmada", "decidido_por": admin_id, "decidido_em": quando})
        self._agendamentos[agendamento_id] = novo
        return novo

    def recusar(self, agendamento_id: str, admin_id: str, quando) -> AgendamentoClinicoRegisto:
        atual = self._agendamentos[agendamento_id]
        novo = self._registo(**{**atual.__dict__, "estado": "recusada", "decidido_por": admin_id, "decidido_em": quando})
        self._agendamentos[agendamento_id] = novo
        return novo


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

    def listar_ativas(self) -> list[ClinicaParceiraRegisto]:
        return [c for c in self._clinicas.values() if c.ativa]

    def obter(self, clinica_id: str) -> ClinicaParceiraRegisto | None:
        return self._clinicas.get(clinica_id)


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
    repo_ag = RepositorioAgendamentosFalso()
    repo_clin = RepositorioClinicasFalso()
    email_sender = EmailSenderFalso()
    token_admin = _seed(repo_auth, "id-admin", "admin")
    token_comum = _seed(repo_auth, "id-comum", "comum")

    app.dependency_overrides[obter_auth_service] = lambda: AuthService(repo_auth)
    app.dependency_overrides[agendamentos_router.obter_agendamento_clinico_repository] = lambda: repo_ag
    app.dependency_overrides[agendamentos_router.obter_clinica_parceira_repository] = lambda: repo_clin
    app.dependency_overrides[agendamentos_router.obter_agendamento_clinico_service] = (
        lambda: AgendamentoClinicoService(repo_ag, repo_clin, email_sender)
    )
    with TestClient(app) as c:
        yield c, repo_ag, token_admin, token_comum, email_sender
    app.dependency_overrides.clear()


_PEDIDO_VALIDO = {
    "clinica_id": "clinica-1",
    "nome": "Ana Silva",
    "email": "ana@example.com",
    "telefone": "+244900000000",
    "modalidade": "presencial",
    "periodo_preferido": "manha",
    "motivo": "Visão turva",
}


def test_listar_clinicas_e_publico(ambiente) -> None:
    c, *_ = ambiente
    resposta = c.get("/clinicas")
    assert resposta.status_code == 200
    assert resposta.json()[0]["nome"] == "Óptica Optioptika"


def test_pedir_agendamento_sem_sessao(ambiente) -> None:
    c, repo_ag, *_ = ambiente
    resposta = c.post("/agendamentos", json=_PEDIDO_VALIDO)
    assert resposta.status_code == 201
    corpo = resposta.json()
    assert corpo["estado"] == "pendente"
    assert repo_ag.obter(corpo["id"]).utilizador_id is None


def test_pedir_agendamento_com_sessao_liga_ao_utilizador(ambiente) -> None:
    c, repo_ag, _, token_comum, _ = ambiente
    c.cookies.set("access_token", token_comum)

    resposta = c.post("/agendamentos", json=_PEDIDO_VALIDO)

    assert resposta.status_code == 201
    assert repo_ag.obter(resposta.json()["id"]).utilizador_id == "id-comum"


def test_pedir_agendamento_com_clinica_forjada_404(ambiente) -> None:
    c, *_ = ambiente
    resposta = c.post("/agendamentos", json={**_PEDIDO_VALIDO, "clinica_id": "nao-existe"})
    assert resposta.status_code == 404


def test_pedir_agendamento_sem_motivo_obrigatorio_funciona(ambiente) -> None:
    c, *_ = ambiente
    dados = {**_PEDIDO_VALIDO}
    del dados["motivo"]
    resposta = c.post("/agendamentos", json=dados)
    assert resposta.status_code == 201


def test_pedir_agendamento_email_invalido_devolve_422(ambiente) -> None:
    c, *_ = ambiente
    resposta = c.post("/agendamentos", json={**_PEDIDO_VALIDO, "email": "nao-e-email"})
    assert resposta.status_code == 422


def test_listar_agendamentos_exige_admin(ambiente) -> None:
    c, _, _, token_comum, _ = ambiente
    c.cookies.set("access_token", token_comum)
    assert c.get("/admin/agendamentos").status_code == 403


def test_listar_agendamentos_sem_sessao_401(ambiente) -> None:
    c, *_ = ambiente
    assert c.get("/admin/agendamentos").status_code == 401


def test_admin_confirma_agendamento(ambiente) -> None:
    c, _, token_admin, _, email_sender = ambiente
    pedido = c.post("/agendamentos", json=_PEDIDO_VALIDO).json()
    email_sender.enviados.clear()
    c.cookies.set("access_token", token_admin)

    resposta = c.post(f"/admin/agendamentos/{pedido['id']}/confirmar")

    assert resposta.status_code == 200
    assert resposta.json()["estado"] == "confirmada"
    assert len(email_sender.enviados) == 1


def test_admin_recusa_agendamento(ambiente) -> None:
    c, _, token_admin, _, _ = ambiente
    pedido = c.post("/agendamentos", json=_PEDIDO_VALIDO).json()
    c.cookies.set("access_token", token_admin)

    resposta = c.post(f"/admin/agendamentos/{pedido['id']}/recusar")

    assert resposta.status_code == 200
    assert resposta.json()["estado"] == "recusada"


def test_confirmar_agendamento_inexistente_404(ambiente) -> None:
    c, _, token_admin, _, _ = ambiente
    c.cookies.set("access_token", token_admin)
    assert c.post("/admin/agendamentos/nao-existe/confirmar").status_code == 404


def test_confirmar_agendamento_ja_decidido_409(ambiente) -> None:
    c, _, token_admin, _, _ = ambiente
    pedido = c.post("/agendamentos", json=_PEDIDO_VALIDO).json()
    c.cookies.set("access_token", token_admin)
    c.post(f"/admin/agendamentos/{pedido['id']}/confirmar")

    resposta = c.post(f"/admin/agendamentos/{pedido['id']}/recusar")

    assert resposta.status_code == 409
