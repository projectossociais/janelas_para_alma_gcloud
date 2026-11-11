"""`/parcerias/*` -- registo público de empresas parceiras."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers import parcerias as parcerias_router
from app.services.candidatura_parceria_service import CandidaturaParceriaService
from tests.services.test_candidatura_parceria_service import (
    EMAIL_EQUIPA,
    ArmazenamentoFalso,
    EmailFalso,
    RepositorioFalso,
)

CORPO = {
    "denominacao": "Clínica Visão Clara, Lda.",
    "nif": "5001234567",
    "tipo": "clinica_oftalmologica",
    "provincia": "Luanda",
    "representante_nome": "Ana Silva",
    "representante_cargo": "Directora Clínica",
    "email": "ana@example.com",
    "telefone": "+244 923 000 000",
    "declaracao": True,
}


@pytest.fixture
def ambiente():
    estado = {
        "repo": RepositorioFalso(),
        "email": EmailFalso(),
        "armazenamento": ArmazenamentoFalso({"parcerias/a.pdf": b"%PDF"}),
    }
    app.dependency_overrides[parcerias_router.obter_candidatura_parceria_service] = (
        lambda: CandidaturaParceriaService(estado["repo"], estado["email"], estado["armazenamento"], EMAIL_EQUIPA)
    )
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c, estado
    app.dependency_overrides.clear()


def test_preparar_documento_e_publico_e_assina_no_prefixo_das_parcerias(ambiente) -> None:
    c, _ = ambiente
    r = c.post("/parcerias/documentos", json={"content_type": "application/pdf"})

    assert r.status_code == 200
    assert r.json()["chave"].startswith("parcerias/")
    assert "url_publico" not in r.json()


def test_preparar_documento_recusa_tipo_invalido_com_422(ambiente) -> None:
    c, _ = ambiente
    assert c.post("/parcerias/documentos", json={"content_type": "application/zip"}).status_code == 422


def test_sem_bucket_privado_o_upload_devolve_503(ambiente) -> None:
    c, estado = ambiente
    estado["armazenamento"] = None
    assert c.post("/parcerias/documentos", json={"content_type": "application/pdf"}).status_code == 503


def test_submeter_sem_sessao_grava_e_devolve_a_referencia(ambiente) -> None:
    c, estado = ambiente
    doc = {"chave": "parcerias/a.pdf", "nome": "Alvará.pdf", "content_type": "application/pdf"}

    r = c.post("/parcerias/candidaturas", json={**CORPO, "documentos": [doc]})

    assert r.status_code == 201
    assert r.json() == {"referencia": "PAR-ABC123"}
    assert len(estado["repo"].criadas) == 1
    para_equipa = next(e for e in estado["email"].enviados if e["destinatario"] == EMAIL_EQUIPA)
    assert [a.nome_ficheiro for a in para_equipa["anexos"]] == ["Alvará.pdf"]


def test_documento_de_outro_prefixo_devolve_403_e_nao_grava(ambiente) -> None:
    c, estado = ambiente
    doc = {"chave": "comprovativos/alheio.pdf", "nome": "x.pdf", "content_type": "application/pdf"}

    r = c.post("/parcerias/candidaturas", json={**CORPO, "documentos": [doc]})

    assert r.status_code == 403
    assert estado["repo"].criadas == []
    assert estado["email"].enviados == []


@pytest.mark.parametrize(
    "alteracao",
    [
        {"declaracao": False},
        {"tipo": "admin"},
        {"email": "nao-e-email"},
        {"nif": "12 34"},
        {"denominacao": ""},
        {"telefone": "abc"},
        {"documentos": [{"chave": f"parcerias/{i}.pdf", "nome": "x.pdf", "content_type": "application/pdf"} for i in range(6)]},
    ],
)
def test_dados_invalidos_devolvem_422_e_nao_gravam(ambiente, alteracao) -> None:
    c, estado = ambiente

    r = c.post("/parcerias/candidaturas", json={**CORPO, **alteracao})

    assert r.status_code == 422
    assert estado["repo"].criadas == []


def test_falha_de_gravacao_nunca_devolve_201(ambiente) -> None:
    c, estado = ambiente
    estado["repo"] = RepositorioFalso(falha=True)

    r = c.post("/parcerias/candidaturas", json=CORPO)

    assert r.status_code == 500
    assert estado["email"].enviados == []
