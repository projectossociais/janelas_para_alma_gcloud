"""`horarios_ocupados` contra Postgres real: uma só consulta por intervalo,
só pedidos activos, só desta clínica."""

from datetime import UTC, datetime, timedelta

from app.repositories.agendamento_clinico_repository import SQLAlchemyAgendamentoClinicoRepository
from app.repositories.orm_models import AgendamentoClinico, ClinicaParceira

INICIO = datetime(2027, 1, 4, 7, 0, tzinfo=UTC)


def _clinica(s, nome: str) -> ClinicaParceira:
    c = ClinicaParceira(nome=nome, email_contacto="c@ex.com", telefone_contacto="+244900000000")
    s.add(c)
    s.flush()
    return c


def _pedido(s, clinica_id, horario: datetime, estado: str = "pendente") -> None:
    s.add(
        AgendamentoClinico(
            clinica_id=clinica_id,
            nome="Ana",
            email="ana@ex.com",
            telefone="+244900000000",
            modalidade="presencial",
            horario_inicio=horario,
            estado=estado,
        )
    )
    s.flush()


def test_devolve_so_pedidos_activos_desta_clinica_no_intervalo(sessao_pg) -> None:
    clinica = _clinica(sessao_pg, "Óptica A")
    outra = _clinica(sessao_pg, "Óptica B")
    _pedido(sessao_pg, clinica.id, INICIO)
    _pedido(sessao_pg, clinica.id, INICIO + timedelta(minutes=30), estado="confirmada")
    _pedido(sessao_pg, clinica.id, INICIO + timedelta(hours=1), estado="recusada")
    _pedido(sessao_pg, clinica.id, INICIO + timedelta(days=30))  # fora do intervalo
    _pedido(sessao_pg, outra.id, INICIO + timedelta(hours=2))

    ocupados = SQLAlchemyAgendamentoClinicoRepository(sessao_pg).horarios_ocupados(
        str(clinica.id), INICIO, INICIO + timedelta(days=7)
    )

    assert ocupados == {INICIO, INICIO + timedelta(minutes=30)}
