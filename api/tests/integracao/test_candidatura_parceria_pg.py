"""`SQLAlchemyCandidaturaParceriaRepository` contra um Postgres real."""

from sqlalchemy import select

from app.repositories.candidatura_parceria_repository import (
    DadosCandidaturaParceria,
    DocumentoParceria,
    SQLAlchemyCandidaturaParceriaRepository,
)
from app.repositories.orm_models import CandidaturaParceria


def test_grava_a_candidatura_com_os_documentos(sessao_pg) -> None:
    dados = DadosCandidaturaParceria(
        denominacao="Clínica Visão Clara, Lda.",
        nif="5001234567",
        tipo="clinica_oftalmologica",
        provincia="Luanda",
        morada=None,
        website=None,
        representante_nome="Ana Silva",
        representante_cargo="Directora",
        email="ana@visaoclara.test",
        telefone="+244 923 000 000",
        mensagem=None,
        documentos=(DocumentoParceria("parcerias/a.pdf", "Alvará.pdf", "application/pdf"),),
    )

    registo = SQLAlchemyCandidaturaParceriaRepository(sessao_pg).criar(dados)

    row = sessao_pg.execute(select(CandidaturaParceria)).scalar_one()
    assert str(row.id) == registo.id
    assert registo.referencia.startswith("PAR-") and row.referencia == registo.referencia
    assert row.estado == "pendente"
    assert row.documentos == [{"chave": "parcerias/a.pdf", "nome": "Alvará.pdf", "content_type": "application/pdf"}]
