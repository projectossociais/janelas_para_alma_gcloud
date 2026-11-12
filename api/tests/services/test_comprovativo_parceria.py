"""O comprovativo de registo em PDF que a empresa candidata recebe."""

from datetime import UTC, datetime
from io import BytesIO

from pypdf import PdfReader

from app.repositories.candidatura_parceria_repository import (
    DadosCandidaturaParceria,
    DocumentoParceria,
)
from app.services.comprovativo_parceria import gerar_comprovativo_parceria


def _dados(**over) -> DadosCandidaturaParceria:
    base = {
        "denominacao": "Clínica Visão Clara, Lda.",
        "nif": "5001234567",
        "tipo": "clinica_oftalmologica",
        "provincia": "Luanda",
        "morada": "Rua da Missão, 12",
        "website": None,
        "representante_nome": "Ana Silva",
        "representante_cargo": "Directora Clínica",
        "email": "ana@visaoclara.test",
        "telefone": "+244 923 000 000",
        "mensagem": "Queremos receber pacientes encaminhados.",
        "documentos": (DocumentoParceria("parcerias/a.pdf", "Alvará.pdf", "application/pdf"),),
    }
    base.update(over)
    return DadosCandidaturaParceria(**base)


def _texto(pdf: bytes) -> str:
    return " ".join(" ".join((pagina.extract_text() or "").split()) for pagina in PdfReader(BytesIO(pdf)).pages)


def test_identifica_o_pedido_a_empresa_e_a_olhar_alinhado() -> None:
    pdf = gerar_comprovativo_parceria("PAR-ABC123", datetime(2026, 11, 10, 12, 0, tzinfo=UTC), _dados())

    texto = _texto(pdf)
    for esperado in (
        "PAR-ABC123",
        "10/11/2026",
        "Clínica Visão Clara, Lda.",
        "5001234567",
        "Clínica oftalmológica",
        "Ana Silva",
        "Alvará.pdf",
        "Olhar Alinhado",
        "5003659364",
        "47643-26/261001",
    ):
        assert esperado in texto, esperado


def test_nunca_mostra_a_morada_da_sede_nem_os_socios() -> None:
    texto = _texto(gerar_comprovativo_parceria("PAR-1", datetime(2026, 11, 10, tzinfo=UTC), _dados()))

    for proibido in ("Moncada", "Ingombota", "Sapalo", "Viegas"):
        assert proibido not in texto


def test_caracteres_fora_do_latim_nao_rebentam_a_geracao() -> None:
    pdf = gerar_comprovativo_parceria(
        "PAR-1", datetime(2026, 11, 10, tzinfo=UTC), _dados(denominacao="Óptica 👁 Luz", documentos=())
    )

    assert pdf.startswith(b"%PDF")
    assert "Nenhum documento" in _texto(pdf)
