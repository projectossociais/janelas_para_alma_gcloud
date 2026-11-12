"""`SQLAlchemyClinicaParceiraRepository.apagar` contra um Postgres real: o
`ON DELETE RESTRICT` de `agendamentos_clinicos` tem de chegar ao service como
`ClinicaComAgendamentosError`, nunca como um `IntegrityError` solto (500)."""

import pytest

from app.repositories.clinica_parceira_repository import (
    ClinicaComAgendamentosError,
    SQLAlchemyClinicaParceiraRepository,
)
from app.repositories.orm_models import AgendamentoClinico, ClinicaParceira


def test_apagar_com_pedido_de_consulta_levanta_erro_de_dominio(sessao_pg) -> None:
    clinica = ClinicaParceira(
        nome="Clínica X", email_contacto="x@example.com", telefone_contacto="+244900000000"
    )
    sessao_pg.add(clinica)
    sessao_pg.flush()
    sessao_pg.add(
        AgendamentoClinico(
            clinica_id=clinica.id,
            nome="Família",
            email="f@example.com",
            telefone="+244911111111",
            modalidade="presencial",
        )
    )
    sessao_pg.commit()

    repo = SQLAlchemyClinicaParceiraRepository(sessao_pg)
    with pytest.raises(ClinicaComAgendamentosError):
        repo.apagar(str(clinica.id))
    # A sessão fica utilizável depois do rollback e a clínica continua lá.
    assert repo.obter(str(clinica.id)) is not None


def test_apagar_sem_pedidos(sessao_pg) -> None:
    clinica = ClinicaParceira(
        nome="Clínica Y", email_contacto="y@example.com", telefone_contacto="+244900000000"
    )
    sessao_pg.add(clinica)
    sessao_pg.commit()
    repo = SQLAlchemyClinicaParceiraRepository(sessao_pg)
    assert repo.apagar(str(clinica.id)) is True
    assert repo.obter(str(clinica.id)) is None
