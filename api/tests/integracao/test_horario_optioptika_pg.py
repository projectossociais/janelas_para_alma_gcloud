"""Seed do horário da Optioptika contra Postgres real: SQL cru que um
repositório falso não apanha, idempotência, e nunca sobrepor um horário que
a clínica já tenha definido no portal."""

from datetime import time

from sqlalchemy import select

from app.repositories.horario_optioptika import JANELAS, NOME_CLINICA, semear_horario_optioptika
from app.repositories.orm_models import ClinicaParceira, DisponibilidadeClinica


def _clinica(s, nome: str = NOME_CLINICA) -> ClinicaParceira:
    c = ClinicaParceira(nome=nome, email_contacto="geral@optioptika.com", telefone_contacto="+244 931 240 304")
    s.add(c)
    s.flush()
    return c


def _janelas(s, clinica_id) -> list[DisponibilidadeClinica]:
    return list(s.scalars(select(DisponibilidadeClinica).where(DisponibilidadeClinica.clinica_id == clinica_id)))


def test_semeia_presencial_e_online(sessao_pg) -> None:
    clinica = _clinica(sessao_pg)
    assert semear_horario_optioptika(sessao_pg.connection()) == len(JANELAS) * 2
    janelas = _janelas(sessao_pg, clinica.id)
    assert {j.modalidade for j in janelas} == {"presencial", "online"}
    assert {(j.dia_semana, j.hora_inicio, j.hora_fim) for j in janelas} == set(JANELAS)


def test_correr_duas_vezes_nao_duplica(sessao_pg) -> None:
    clinica = _clinica(sessao_pg)
    semear_horario_optioptika(sessao_pg.connection())
    assert semear_horario_optioptika(sessao_pg.connection()) == 0
    assert len(_janelas(sessao_pg, clinica.id)) == len(JANELAS) * 2


def test_nao_sobrepoe_horario_definido_pela_clinica(sessao_pg) -> None:
    clinica = _clinica(sessao_pg)
    sessao_pg.add(
        DisponibilidadeClinica(
            clinica_id=clinica.id, dia_semana=4, hora_inicio=time(10, 0), hora_fim=time(12, 0), modalidade="presencial"
        )
    )
    sessao_pg.flush()
    assert semear_horario_optioptika(sessao_pg.connection()) == 0
    assert len(_janelas(sessao_pg, clinica.id)) == 1


def test_sem_a_clinica_nao_faz_nada(sessao_pg) -> None:
    outra = _clinica(sessao_pg, nome="Outra Clínica")
    assert semear_horario_optioptika(sessao_pg.connection()) == 0
    assert _janelas(sessao_pg, outra.id) == []
