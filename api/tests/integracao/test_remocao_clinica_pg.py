"""A gravação de pedidos e a remoção da clínica são serializadas no Postgres."""

from datetime import UTC, datetime

from app.repositories.agendamento_clinico_repository import (
    AgendamentoClinicoRegisto,
    SQLAlchemyAgendamentoClinicoRepository,
)
from app.repositories.clinica_parceira_repository import SQLAlchemyClinicaParceiraRepository
from app.repositories.orm_models import ClinicaParceira
from app.services.clinica_parceira_service import (
    ClinicaParceiraService,
    ResultadoRemocao,
)


def _criar_pedido(
    repo: SQLAlchemyAgendamentoClinicoRepository, clinica_id: str
) -> AgendamentoClinicoRegisto | None:
    return repo.criar(
        clinica_id=clinica_id,
        utilizador_id=None,
        screening_id=None,
        nome="Ana Silva",
        email="ana@example.com",
        telefone="+244900000000",
        modalidade="presencial",
        horario_inicio=datetime(2027, 1, 4, 9, 0, tzinfo=UTC),
        motivo=None,
    )


def test_pedido_nao_e_criado_depois_de_a_clinica_ser_removida(sessao_pg) -> None:
    clinica = ClinicaParceira(
        nome="Clínica",
        email_contacto="clinica@example.com",
        telefone_contacto="+244900000001",
    )
    sessao_pg.add(clinica)
    sessao_pg.commit()

    repositorio_clinicas = SQLAlchemyClinicaParceiraRepository(sessao_pg)
    repositorio_agendamentos = SQLAlchemyAgendamentoClinicoRepository(sessao_pg)

    assert _criar_pedido(repositorio_agendamentos, str(clinica.id)) is not None
    resultado = ClinicaParceiraService(repositorio_clinicas).remover(str(clinica.id))

    assert resultado == ResultadoRemocao.desativada
    assert _criar_pedido(repositorio_agendamentos, str(clinica.id)) is None
    assert repositorio_agendamentos.listar()[0].clinica_id == str(clinica.id)


def test_pedido_nao_e_criado_se_a_clinica_foi_apagada(sessao_pg) -> None:
    clinica = ClinicaParceira(
        nome="Clínica",
        email_contacto="clinica@example.com",
        telefone_contacto="+244900000001",
    )
    sessao_pg.add(clinica)
    sessao_pg.commit()

    repositorio_clinicas = SQLAlchemyClinicaParceiraRepository(sessao_pg)
    repositorio_agendamentos = SQLAlchemyAgendamentoClinicoRepository(sessao_pg)

    resultado = ClinicaParceiraService(repositorio_clinicas).remover(str(clinica.id))

    assert resultado == ResultadoRemocao.apagada
    assert _criar_pedido(repositorio_agendamentos, str(clinica.id)) is None
