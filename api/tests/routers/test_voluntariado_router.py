from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.core.dependencies import obter_auth_service
from app.core.security import criar_access_token, hash_password
from app.main import app
from app.repositories.atividade_voluntariado_repository import (
    AtividadeVoluntariadoRegisto,
    InscricaoAtividadeRegisto,
    VoluntarioParaNotificar,
)
from app.repositories.candidatura_voluntariado_repository import CandidaturaVoluntariadoRegisto
from app.repositories.utilizadores_repository import UtilizadorRegisto
from app.routers import voluntariado as voluntariado_router
from app.services.atividade_voluntariado_service import AtividadeVoluntariadoService
from app.services.auth_service import AuthService
from app.services.candidatura_voluntariado_service import CandidaturaVoluntariadoService
from tests.services.test_auth_service import RepositorioFalso as RepositorioAuthFalso

_AGORA = datetime.now(UTC)


class RepositorioCandidaturaFalso:
    def __init__(self) -> None:
        self._candidaturas: dict[str, CandidaturaVoluntariadoRegisto] = {}
        self._seq = 0

    def _registo(self, **over) -> CandidaturaVoluntariadoRegisto:
        base = {
            "id": "",
            "utilizador_id": "",
            "utilizador_email": "",
            "utilizador_nome": None,
            "motivacao": "",
            "telefone": None,
            "status": "pendente",
            "decidido_por": None,
            "decidido_em": None,
            "created_at": _AGORA,
        }
        base.update(over)
        return CandidaturaVoluntariadoRegisto(**base)

    def criar(self, utilizador_id, motivacao, telefone) -> CandidaturaVoluntariadoRegisto:
        self._seq += 1
        reg = self._registo(
            id=f"cand-{self._seq}",
            utilizador_id=utilizador_id,
            utilizador_email=f"{utilizador_id}@example.com",
            motivacao=motivacao,
            telefone=telefone,
        )
        self._candidaturas[reg.id] = reg
        return reg

    def obter(self, candidatura_id) -> CandidaturaVoluntariadoRegisto | None:
        return self._candidaturas.get(candidatura_id)

    def obter_por_utilizador(self, utilizador_id) -> CandidaturaVoluntariadoRegisto | None:
        for c in self._candidaturas.values():
            if c.utilizador_id == utilizador_id:
                return c
        return None

    def listar(self) -> list[CandidaturaVoluntariadoRegisto]:
        return list(self._candidaturas.values())

    def aprovar(self, candidatura_id, admin_id, quando) -> CandidaturaVoluntariadoRegisto:
        c = self._candidaturas[candidatura_id]
        novo = self._registo(**{**c.__dict__, "status": "aprovada", "decidido_por": admin_id, "decidido_em": quando})
        self._candidaturas[candidatura_id] = novo
        return novo

    def rejeitar(self, candidatura_id, admin_id, quando) -> CandidaturaVoluntariadoRegisto:
        c = self._candidaturas[candidatura_id]
        novo = self._registo(**{**c.__dict__, "status": "rejeitada", "decidido_por": admin_id, "decidido_em": quando})
        self._candidaturas[candidatura_id] = novo
        return novo


class RepositorioAtividadeFalso:
    def __init__(self) -> None:
        self._atividades: dict[str, AtividadeVoluntariadoRegisto] = {}
        self._inscricoes: dict[str, InscricaoAtividadeRegisto] = {}
        self._voluntarios_ativos: set[str] = set()
        self._seq_a = 0
        self._seq_i = 0

    def marcar_voluntario_ativo(self, utilizador_id: str) -> None:
        self._voluntarios_ativos.add(utilizador_id)

    def criar_atividade(self, titulo, descricao, local, data_inicio, data_fim, vagas, criado_por):
        self._seq_a += 1
        reg = AtividadeVoluntariadoRegisto(
            id=f"ativ-{self._seq_a}",
            titulo=titulo,
            descricao=descricao,
            local=local,
            data_inicio=data_inicio,
            data_fim=data_fim,
            vagas=vagas,
            inscritos=0,
            estado="publicada",
            criado_por=criado_por,
            created_at=_AGORA,
        )
        self._atividades[reg.id] = reg
        return reg

    def obter_atividade(self, atividade_id) -> AtividadeVoluntariadoRegisto | None:
        return self._atividades.get(atividade_id)

    def listar_publicadas(self) -> list[AtividadeVoluntariadoRegisto]:
        return [a for a in self._atividades.values() if a.estado == "publicada"]

    def listar_todas(self) -> list[AtividadeVoluntariadoRegisto]:
        return list(self._atividades.values())

    def cancelar_atividade(self, atividade_id) -> AtividadeVoluntariadoRegisto:
        a = self._atividades[atividade_id]
        novo = AtividadeVoluntariadoRegisto(**{**a.__dict__, "estado": "cancelada"})
        self._atividades[atividade_id] = novo
        return novo

    def arquivar_atividade(self, atividade_id) -> AtividadeVoluntariadoRegisto:
        a = self._atividades[atividade_id]
        novo = AtividadeVoluntariadoRegisto(**{**a.__dict__, "estado": "arquivada"})
        self._atividades[atividade_id] = novo
        return novo

    def tem_alguma_inscricao(self, atividade_id) -> bool:
        return any(i.atividade_id == atividade_id for i in self._inscricoes.values())

    def apagar_atividade(self, atividade_id) -> None:
        self._atividades.pop(atividade_id, None)

    def utilizador_e_voluntario_ativo(self, utilizador_id) -> bool:
        return utilizador_id in self._voluntarios_ativos

    def _contagem(self, atividade_id: str) -> int:
        return len([i for i in self._inscricoes.values() if i.atividade_id == atividade_id and i.estado == "inscrito"])

    def criar_inscricao(self, atividade_id, utilizador_id) -> InscricaoAtividadeRegisto:
        self._seq_i += 1
        atividade = self._atividades[atividade_id]
        reg = InscricaoAtividadeRegisto(
            id=f"insc-{self._seq_i}",
            atividade_id=atividade_id,
            atividade_titulo=atividade.titulo,
            atividade_data_inicio=atividade.data_inicio,
            atividade_local=atividade.local,
            utilizador_id=utilizador_id,
            utilizador_email=f"{utilizador_id}@example.com",
            utilizador_nome=None,
            estado="inscrito",
            created_at=_AGORA,
        )
        self._inscricoes[reg.id] = reg
        self._atividades[atividade_id] = AtividadeVoluntariadoRegisto(
            **{**atividade.__dict__, "inscritos": self._contagem(atividade_id)}
        )
        return reg

    def obter_inscricao(self, atividade_id, utilizador_id) -> InscricaoAtividadeRegisto | None:
        for i in self._inscricoes.values():
            if i.atividade_id == atividade_id and i.utilizador_id == utilizador_id and i.estado == "inscrito":
                return i
        return None

    def cancelar_inscricao(self, inscricao_id) -> InscricaoAtividadeRegisto:
        i = self._inscricoes[inscricao_id]
        novo = InscricaoAtividadeRegisto(**{**i.__dict__, "estado": "cancelado"})
        self._inscricoes[inscricao_id] = novo
        return novo

    def listar_inscricoes_por_utilizador(self, utilizador_id) -> list[InscricaoAtividadeRegisto]:
        return [i for i in self._inscricoes.values() if i.utilizador_id == utilizador_id and i.estado == "inscrito"]

    def listar_inscricoes_por_atividade(self, atividade_id) -> list[InscricaoAtividadeRegisto]:
        return [i for i in self._inscricoes.values() if i.atividade_id == atividade_id and i.estado == "inscrito"]

    def listar_voluntarios_para_notificar(self) -> list[VoluntarioParaNotificar]:
        return []


class EmailSenderFalso:
    def __init__(self) -> None:
        self.enviados: list[dict] = []

    def enviar(self, destinatario, assunto, corpo_html) -> None:
        self.enviados.append({"destinatario": destinatario, "assunto": assunto, "corpo_html": corpo_html})


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
    repo_cand = RepositorioCandidaturaFalso()
    repo_ativ = RepositorioAtividadeFalso()
    email_sender = EmailSenderFalso()
    token_admin = _seed(repo_auth, "id-admin", "admin")
    token_comum = _seed(repo_auth, "id-comum", "comum")
    token_voluntario = _seed(repo_auth, "id-voluntario", "comum")
    repo_ativ.marcar_voluntario_ativo("id-voluntario")

    app.dependency_overrides[obter_auth_service] = lambda: AuthService(repo_auth)
    app.dependency_overrides[voluntariado_router.obter_candidatura_repository] = lambda: repo_cand
    app.dependency_overrides[voluntariado_router.obter_candidatura_service] = (
        lambda: CandidaturaVoluntariadoService(repo_cand, email_sender)
    )
    app.dependency_overrides[voluntariado_router.obter_atividade_repository] = lambda: repo_ativ
    app.dependency_overrides[voluntariado_router.obter_atividade_service] = (
        lambda: AtividadeVoluntariadoService(repo_ativ, email_sender)
    )
    with TestClient(app) as c:
        yield c, repo_cand, repo_ativ, token_admin, token_comum, token_voluntario
    app.dependency_overrides.clear()


# --- candidatura ------------------------------------------------------------


def test_candidatar_sem_sessao_401(ambiente) -> None:
    c, *_ = ambiente
    r = c.post("/voluntariado/candidatar", json={"motivacao": "Quero ajudar"})
    assert r.status_code == 401


def test_candidatar_com_sessao(ambiente) -> None:
    c, repo_cand, _, _, token_comum, _ = ambiente
    c.cookies.set("access_token", token_comum)
    r = c.post("/voluntariado/candidatar", json={"motivacao": "Quero ajudar", "telefone": "+244900000000"})
    assert r.status_code == 201
    assert r.json()["status"] == "pendente"
    assert repo_cand.listar()[0].utilizador_id == "id-comum"


def test_candidatar_duas_vezes_409(ambiente) -> None:
    c, _, _, _, token_comum, _ = ambiente
    c.cookies.set("access_token", token_comum)
    c.post("/voluntariado/candidatar", json={"motivacao": "Quero ajudar"})
    r = c.post("/voluntariado/candidatar", json={"motivacao": "De novo"})
    assert r.status_code == 409


def test_listar_candidaturas_exige_admin(ambiente) -> None:
    c, _, _, _, token_comum, _ = ambiente
    c.cookies.set("access_token", token_comum)
    assert c.get("/voluntariado/candidaturas").status_code == 403


def test_admin_aprova_candidatura(ambiente) -> None:
    # Nota: o router de candidaturas e o de actividades usam aqui dois
    # repositórios falsos independentes (ao contrário dos reais, que
    # partilham a mesma tabela `utilizadores` — ver
    # SQLAlchemyCandidaturaVoluntariadoRepository.aprovar, mesmo desenho já
    # comprovado em premium_repository.py), por isso este teste verifica só
    # o contrato HTTP da aprovação, não o efeito lateral no voluntariado.
    c, repo_cand, _, token_admin, token_comum, _ = ambiente
    c.cookies.set("access_token", token_comum)
    c.post("/voluntariado/candidatar", json={"motivacao": "Quero ajudar"})
    cand_id = repo_cand.listar()[0].id

    c.cookies.set("access_token", token_admin)
    r = c.post(f"/voluntariado/candidaturas/{cand_id}/aprovar")
    assert r.status_code == 200
    assert r.json()["status"] == "aprovada"
    assert r.json()["decidido_por"] == "id-admin"


def test_aprovar_candidatura_inexistente_404(ambiente) -> None:
    c, *_, token_admin, _, _ = ambiente
    c.cookies.set("access_token", token_admin)
    assert c.post("/voluntariado/candidaturas/cand-999/aprovar").status_code == 404


# --- atividades ---------------------------------------------------------


def test_publicar_atividade_exige_admin(ambiente) -> None:
    c, *_, token_comum, _ = ambiente
    c.cookies.set("access_token", token_comum)
    r = c.post(
        "/voluntariado/atividades",
        json={
            "titulo": "Rastreio",
            "descricao": "Ajudar",
            "local": "Luanda",
            "data_inicio": (_AGORA + timedelta(days=1)).isoformat(),
        },
    )
    assert r.status_code == 403


def test_admin_publica_atividade(ambiente) -> None:
    c, *_, token_admin, _, _ = ambiente
    c.cookies.set("access_token", token_admin)
    r = c.post(
        "/voluntariado/atividades",
        json={
            "titulo": "Rastreio",
            "descricao": "Ajudar no rastreio",
            "local": "Luanda",
            "data_inicio": (_AGORA + timedelta(days=1)).isoformat(),
            "vagas": 5,
        },
    )
    assert r.status_code == 201
    assert r.json()["titulo"] == "Rastreio"


def test_listar_atividades_publicadas(ambiente) -> None:
    c, *_, token_admin, _, token_voluntario = ambiente
    c.cookies.set("access_token", token_admin)
    c.post(
        "/voluntariado/atividades",
        json={
            "titulo": "Rastreio",
            "descricao": "Ajudar",
            "local": "Luanda",
            "data_inicio": (_AGORA + timedelta(days=1)).isoformat(),
        },
    )
    c.cookies.set("access_token", token_voluntario)
    r = c.get("/voluntariado/atividades")
    assert r.status_code == 200
    assert len(r.json()) == 1


# --- inscrições ------------------------------------------------------------


def _publicar_atividade(c, token_admin, **over) -> str:
    payload = {
        "titulo": "Rastreio",
        "descricao": "Ajudar",
        "local": "Luanda",
        "data_inicio": (_AGORA + timedelta(days=1)).isoformat(),
    }
    payload.update(over)
    c.cookies.set("access_token", token_admin)
    r = c.post("/voluntariado/atividades", json=payload)
    return r.json()["id"]


def test_inscrever_exige_voluntario_ativo(ambiente) -> None:
    c, *_, token_admin, token_comum, _ = ambiente
    atividade_id = _publicar_atividade(c, token_admin)
    c.cookies.set("access_token", token_comum)
    r = c.post(f"/voluntariado/atividades/{atividade_id}/inscrever")
    assert r.status_code == 403


def test_voluntario_ativo_inscreve_se(ambiente) -> None:
    c, *_, token_admin, _, token_voluntario = ambiente
    atividade_id = _publicar_atividade(c, token_admin)
    c.cookies.set("access_token", token_voluntario)
    r = c.post(f"/voluntariado/atividades/{atividade_id}/inscrever")
    assert r.status_code == 201
    assert r.json()["atividade_id"] == atividade_id


def test_nao_pode_inscrever_se_duas_vezes(ambiente) -> None:
    c, *_, token_admin, _, token_voluntario = ambiente
    atividade_id = _publicar_atividade(c, token_admin)
    c.cookies.set("access_token", token_voluntario)
    c.post(f"/voluntariado/atividades/{atividade_id}/inscrever")
    r = c.post(f"/voluntariado/atividades/{atividade_id}/inscrever")
    assert r.status_code == 409


def test_sem_vagas_409(ambiente) -> None:
    c, *_, token_admin, _, token_voluntario = ambiente
    atividade_id = _publicar_atividade(c, token_admin, vagas=1)
    c.cookies.set("access_token", token_voluntario)
    c.post(f"/voluntariado/atividades/{atividade_id}/inscrever")

    # segundo voluntário activo tenta a mesma actividade, já sem vagas
    _, _, repo_ativ, *_ = ambiente
    repo_ativ.marcar_voluntario_ativo("id-comum")

    # sobe a sessão do "id-comum", agora também marcado como voluntário activo
    c.cookies.set("access_token", criar_access_token("id-comum"))
    r = c.post(f"/voluntariado/atividades/{atividade_id}/inscrever")
    assert r.status_code == 409


def test_cancelar_inscricao(ambiente) -> None:
    c, *_, token_admin, _, token_voluntario = ambiente
    atividade_id = _publicar_atividade(c, token_admin)
    c.cookies.set("access_token", token_voluntario)
    c.post(f"/voluntariado/atividades/{atividade_id}/inscrever")

    r = c.delete(f"/voluntariado/atividades/{atividade_id}/inscrever")
    assert r.status_code == 200
    assert r.json()["estado"] == "cancelado"


def test_cancelar_inscricao_inexistente_404(ambiente) -> None:
    c, *_, token_admin, _, token_voluntario = ambiente
    atividade_id = _publicar_atividade(c, token_admin)
    c.cookies.set("access_token", token_voluntario)
    r = c.delete(f"/voluntariado/atividades/{atividade_id}/inscrever")
    assert r.status_code == 404


def test_minhas_inscricoes(ambiente) -> None:
    c, *_, token_admin, _, token_voluntario = ambiente
    atividade_id = _publicar_atividade(c, token_admin)
    c.cookies.set("access_token", token_voluntario)
    c.post(f"/voluntariado/atividades/{atividade_id}/inscrever")

    r = c.get("/voluntariado/minhas-inscricoes")
    assert r.status_code == 200
    assert len(r.json()) == 1


def test_listar_inscritos_exige_admin(ambiente) -> None:
    c, *_, token_admin, token_comum, token_voluntario = ambiente
    atividade_id = _publicar_atividade(c, token_admin)
    c.cookies.set("access_token", token_voluntario)
    c.post(f"/voluntariado/atividades/{atividade_id}/inscrever")

    c.cookies.set("access_token", token_comum)
    assert c.get(f"/voluntariado/atividades/{atividade_id}/inscritos").status_code == 403

    c.cookies.set("access_token", token_admin)
    r = c.get(f"/voluntariado/atividades/{atividade_id}/inscritos")
    assert r.status_code == 200
    assert len(r.json()) == 1


# --- arquivar / apagar -------------------------------------------------------


def test_arquivar_atividade(ambiente) -> None:
    c, *_, token_admin, _, _ = ambiente
    atividade_id = _publicar_atividade(c, token_admin)

    r = c.post(f"/voluntariado/atividades/{atividade_id}/arquivar")

    assert r.status_code == 200
    assert r.json()["estado"] == "arquivada"


def test_arquivar_atividade_exige_admin(ambiente) -> None:
    c, *_, token_admin, token_comum, _ = ambiente
    atividade_id = _publicar_atividade(c, token_admin)
    c.cookies.set("access_token", token_comum)

    assert c.post(f"/voluntariado/atividades/{atividade_id}/arquivar").status_code == 403


def test_arquivar_atividade_inexistente_404(ambiente) -> None:
    c, *_, token_admin, _, _ = ambiente
    c.cookies.set("access_token", token_admin)

    assert c.post("/voluntariado/atividades/nao-existe/arquivar").status_code == 404


def test_apagar_atividade_sem_inscricoes(ambiente) -> None:
    c, *_, token_admin, _, _ = ambiente
    atividade_id = _publicar_atividade(c, token_admin)

    r = c.delete(f"/voluntariado/atividades/{atividade_id}")

    assert r.status_code == 204
    assert atividade_id not in [a["id"] for a in c.get("/voluntariado/atividades/todas").json()]


def test_apagar_atividade_com_inscricoes_409(ambiente) -> None:
    c, *_, token_admin, _, token_voluntario = ambiente
    atividade_id = _publicar_atividade(c, token_admin)
    c.cookies.set("access_token", token_voluntario)
    c.post(f"/voluntariado/atividades/{atividade_id}/inscrever")

    c.cookies.set("access_token", token_admin)
    r = c.delete(f"/voluntariado/atividades/{atividade_id}")

    assert r.status_code == 409


def test_apagar_atividade_exige_admin(ambiente) -> None:
    c, *_, token_admin, token_comum, _ = ambiente
    atividade_id = _publicar_atividade(c, token_admin)
    c.cookies.set("access_token", token_comum)

    assert c.delete(f"/voluntariado/atividades/{atividade_id}").status_code == 403


def test_apagar_atividade_inexistente_404(ambiente) -> None:
    c, *_, token_admin, _, _ = ambiente
    c.cookies.set("access_token", token_admin)

    assert c.delete("/voluntariado/atividades/nao-existe").status_code == 404
