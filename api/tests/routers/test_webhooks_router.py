import pytest
from fastapi.testclient import TestClient

from app.core.config import obter_settings
from app.main import app
from app.routers import webhooks as webhooks_router
from app.services.compra_loja_service import EventoLoja

SEGREDO = "segredo-revenuecat-de-teste"

CORPO = {
    "api_version": "1.0",
    "event": {
        "id": "evt-1",
        "type": "INITIAL_PURCHASE",
        "app_user_id": "7f1e9d2a-4b6c-4c1d-9e8f-0a1b2c3d4e5f",
        "store": "PLAY_STORE",
        "environment": "PRODUCTION",
        "product_id": "jpa_premium_mensal:mensal",
        "transaction_id": "GPA.1234",
        "original_transaction_id": "GPA.1234",
        "purchased_at_ms": 1793361600000,
        "expiration_at_ms": 1795953600000,
        "price": 15.99,
        "currency": "USD",
    },
}


class ServicoFalso:
    def __init__(self, resultado: str = "aplicada") -> None:
        self.resultado = resultado
        self.eventos: list[EventoLoja] = []

    def processar(self, evento: EventoLoja) -> str:
        self.eventos.append(evento)
        return self.resultado


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def servico(monkeypatch) -> ServicoFalso:
    monkeypatch.setattr(obter_settings(), "revenuecat_webhook_segredo", SEGREDO)
    falso = ServicoFalso()
    app.dependency_overrides[webhooks_router.obter_compra_loja_service] = lambda: falso
    return falso


def test_sem_segredo_configurado_recusa_sempre(client, monkeypatch) -> None:
    monkeypatch.setattr(obter_settings(), "revenuecat_webhook_segredo", "")
    resposta = client.post("/webhooks/revenuecat", json=CORPO, headers={"Authorization": ""})
    assert resposta.status_code == 403


def test_sem_cabecalho_ou_com_segredo_errado_devolve_403(client, servico) -> None:
    assert client.post("/webhooks/revenuecat", json=CORPO).status_code == 403
    errado = client.post("/webhooks/revenuecat", json=CORPO, headers={"Authorization": "errado"})
    assert errado.status_code == 403
    assert servico.eventos == []


def test_com_o_segredo_converte_o_evento_e_devolve_o_resultado(client, servico) -> None:
    resposta = client.post("/webhooks/revenuecat", json=CORPO, headers={"Authorization": SEGREDO})

    assert resposta.status_code == 200
    assert resposta.json() == {"resultado": "aplicada"}
    (evento,) = servico.eventos
    assert evento.utilizador_id == CORPO["event"]["app_user_id"]
    assert evento.loja == "PLAY_STORE"
    assert evento.transacao_id == "GPA.1234"
    assert (evento.expira_em - evento.comprado_em).days == 30
    assert evento.comprado_em.tzinfo is not None


def test_evento_de_teste_do_painel_responde_200(client, servico) -> None:
    servico.resultado = "ignorada"
    corpo = {"api_version": "1.0", "event": {"type": "TEST", "app_user_id": "x", "store": "APP_STORE"}}
    resposta = client.post("/webhooks/revenuecat", json=corpo, headers={"Authorization": SEGREDO})
    assert resposta.status_code == 200
    assert resposta.json() == {"resultado": "ignorada"}


def test_corpo_sem_evento_devolve_422(client, servico) -> None:
    resposta = client.post("/webhooks/revenuecat", json={"api_version": "1.0"}, headers={"Authorization": SEGREDO})
    assert resposta.status_code == 422
