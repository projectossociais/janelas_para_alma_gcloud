"""O horário que a migração `c7e2a9f4b1d6` semeia para a Optioptika -- sem
base de dados. A inserção contra um Postgres real está em
`tests/integracao/test_horario_optioptika_pg.py`."""

from datetime import UTC, datetime

from app.core.fuso import FUSO_LUANDA
from app.repositories.clinica_parceira_repository import ClinicaParceiraRegisto
from app.repositories.disponibilidade_clinica_repository import DisponibilidadeRegisto
from app.repositories.horario_optioptika import JANELAS, MODALIDADES, linhas_a_semear
from app.services.agendamento_clinico_service import AgendamentoClinicoService


class _Clinicas:
    def obter(self, clinica_id: str) -> ClinicaParceiraRegisto:
        return ClinicaParceiraRegisto(
            id=clinica_id,
            nome="Óptica Optioptika",
            email_contacto="geral@optioptika.com",
            telefone_contacto="+244 931 240 304",
            ativa=True,
            especialidades=[],
            cidade="Luanda",
            modalidades_suportadas=list(MODALIDADES),
            preco_indicativo=None,
            created_at=datetime.now(UTC),
        )


class _Disponibilidades:
    def listar_por_clinica(self, clinica_id: str) -> list[DisponibilidadeRegisto]:
        return [
            DisponibilidadeRegisto(id=f"d{i}", created_at=datetime.now(UTC), **linha)
            for i, linha in enumerate(linhas_a_semear(clinica_id))
        ]


class _Agendamentos:
    def existe_conflito(self, clinica_id: str, horario_inicio: datetime) -> bool:
        return False


def _servico() -> AgendamentoClinicoService:
    return AgendamentoClinicoService(_Agendamentos(), _Clinicas(), _Disponibilidades(), None, None)


def test_janelas_seguem_o_horario_publicado_no_perfil() -> None:
    # Seg–Qui 08h–17h, Sáb 08h–13h -- sexta e domingo fechados.
    assert {dia for dia, _, _ in JANELAS} == {0, 1, 2, 3, 5}
    for dia, inicio, fim in JANELAS:
        assert 0 <= dia <= 6
        assert inicio < fim


def test_semeia_as_duas_modalidades() -> None:
    linhas = linhas_a_semear("clinica-1")
    assert len(linhas) == len(JANELAS) * 2
    assert {linha["modalidade"] for linha in linhas} == {"presencial", "online"}


def test_o_dialogo_passa_a_ter_horarios_nas_duas_modalidades() -> None:
    servico = _servico()
    for modalidade in MODALIDADES:
        horarios = servico.horarios_disponiveis("clinica-1", modalidade)
        assert horarios, modalidade
        dias_locais = {h.inicio.astimezone(FUSO_LUANDA).weekday() for h in horarios}
        assert dias_locais <= {0, 1, 2, 3, 5}
