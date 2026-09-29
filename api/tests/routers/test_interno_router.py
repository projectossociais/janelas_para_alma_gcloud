import pytest
from fastapi.testclient import TestClient

from app.core.config import obter_settings
from app.core.dependencies import obter_cron_valido
from app.main import app
from app.routers import interno as interno_router
from app.services.eliminacao_conta_service import EliminacaoContaService


class RepositorioFalso:
    def __init__(self, pendentes: list[str] | None = None) -> None:
        self._pendentes = pendentes or []
        self.anonimizados: list[str] = []

    def listar_pendentes(self, agora):
        return list(self._pendentes)

    def anonimizar(self, utilizador_id, agora, email_anonimo, password_hash_invalido, nome_anonimo) -> None:
        self.anonimizados.append(utilizador_id)


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_sem_segredo_devolve_403(client) -> None:
    resposta = client.post("/interno/eliminar-contas-pendentes")
    assert resposta.status_code == 403


def test_com_segredo_errado_devolve_403(client) -> None:
    resposta = client.post("/interno/eliminar-contas-pendentes", headers={"x-cron-secret": "errado"})
    assert resposta.status_code == 403


def test_com_o_segredo_real_configurado_e_correto_passa(client, monkeypatch) -> None:
    monkeypatch.setattr(obter_settings(), "cron_secret", "segredo-de-teste")
    app.dependency_overrides[interno_router.obter_eliminacao_conta_service] = lambda: EliminacaoContaService(
        RepositorioFalso(pendentes=[])
    )

    resposta = client.post("/interno/eliminar-contas-pendentes", headers={"x-cron-secret": "segredo-de-teste"})

    assert resposta.status_code == 200


def test_com_o_segredo_real_configurado_mas_errado_recusa(client, monkeypatch) -> None:
    monkeypatch.setattr(obter_settings(), "cron_secret", "segredo-de-teste")

    resposta = client.post("/interno/eliminar-contas-pendentes", headers={"x-cron-secret": "outro-valor"})

    assert resposta.status_code == 403


def test_com_segredo_correto_processa_as_contas_pendentes(client) -> None:
    repo = RepositorioFalso(pendentes=["u-1", "u-2"])
    app.dependency_overrides[obter_cron_valido] = lambda: None
    app.dependency_overrides[interno_router.obter_eliminacao_conta_service] = lambda: EliminacaoContaService(repo)

    resposta = client.post("/interno/eliminar-contas-pendentes")

    assert resposta.status_code == 200
    assert resposta.json() == {"contas_anonimizadas": 2}
    assert repo.anonimizados == ["u-1", "u-2"]


def test_sem_contas_pendentes_devolve_zero(client) -> None:
    app.dependency_overrides[obter_cron_valido] = lambda: None
    app.dependency_overrides[interno_router.obter_eliminacao_conta_service] = lambda: EliminacaoContaService(
        RepositorioFalso(pendentes=[])
    )

    resposta = client.post("/interno/eliminar-contas-pendentes")

    assert resposta.status_code == 200
    assert resposta.json() == {"contas_anonimizadas": 0}


# --- Lembretes diários de treino (Fase A, docs/ANALISE_EXERCICIOS.md) ------


def test_lembretes_sem_segredo_devolve_403(client) -> None:
    assert client.post("/interno/lembretes-exercicios").status_code == 403


def test_lembretes_com_segredo_envia_e_devolve_as_contagens(client) -> None:
    from app.repositories.lembrete_exercicios_repository import DestinatarioLembrete
    from app.services.lembrete_exercicios_service import LembreteExerciciosService
    from tests.services.test_lembrete_exercicios_service import EmailSenderFalso
    from tests.services.test_lembrete_exercicios_service import RepositorioFalso as RepoLembretes

    sender = EmailSenderFalso(falhar_para={"b@example.com"})
    repo = RepoLembretes([DestinatarioLembrete("u1", "a@example.com", "Ana"), DestinatarioLembrete("u2", "b@example.com", None)])
    app.dependency_overrides[obter_cron_valido] = lambda: None
    app.dependency_overrides[interno_router.obter_lembrete_exercicios_service] = lambda: LembreteExerciciosService(repo, sender)

    resposta = client.post("/interno/lembretes-exercicios")

    assert resposta.status_code == 200
    assert resposta.json() == {"enviados": 1, "falhados": 1}
