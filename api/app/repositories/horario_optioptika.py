"""Horário semanal da Optioptika, semeado pela migração `c7e2a9f4b1d6`.

A Optioptika nunca registou janelas no portal (`DashboardPro.tsx`), por isso
`GET /clinicas/{id}/horarios` devolvia sempre `[]` e o diálogo de marcação
mostrava "Sem horários disponíveis" -- o agendamento parecia desligado. As
janelas abaixo são o horário que a própria clínica publica no perfil
(`optioptika.segQui08h17h`: Seg–Qui 08h–17h, Sáb 08h–13h), em hora de
Luanda, para presencial e online (o perfil anuncia as duas).

Não importa o ORM -- a migração não pode depender dele.
"""

from datetime import time

from sqlalchemy import text
from sqlalchemy.engine import Connection

NOME_CLINICA = "Óptica Optioptika"
MODALIDADES = ("presencial", "online")

# (dia_semana, hora_inicio, hora_fim) -- dia_semana segue date.weekday(): 0 = segunda.
JANELAS = (
    (0, time(8, 0), time(17, 0)),
    (1, time(8, 0), time(17, 0)),
    (2, time(8, 0), time(17, 0)),
    (3, time(8, 0), time(17, 0)),
    (5, time(8, 0), time(13, 0)),
)


def linhas_a_semear(clinica_id) -> list[dict]:
    return [
        {"clinica_id": clinica_id, "dia_semana": dia, "hora_inicio": inicio, "hora_fim": fim, "modalidade": modalidade}
        for modalidade in MODALIDADES
        for dia, inicio, fim in JANELAS
    ]


def semear_horario_optioptika(conexao: Connection) -> int:
    """Insere as janelas só se a clínica existir e ainda não tiver nenhuma --
    nunca sobrepõe um horário que a clínica já tenha definido no portal.
    Devolve quantas linhas inseriu."""
    clinica_id = conexao.execute(
        text("SELECT id FROM clinicas_parceiras WHERE nome = :nome ORDER BY created_at LIMIT 1"),
        {"nome": NOME_CLINICA},
    ).scalar()
    if clinica_id is None:
        return 0

    ja_tem_horario = conexao.execute(
        text("SELECT 1 FROM disponibilidade_clinica WHERE clinica_id = :id LIMIT 1"),
        {"id": clinica_id},
    ).first()
    if ja_tem_horario is not None:
        return 0

    linhas = linhas_a_semear(clinica_id)
    conexao.execute(
        text(
            "INSERT INTO disponibilidade_clinica (clinica_id, dia_semana, hora_inicio, hora_fim, modalidade) "
            "VALUES (:clinica_id, :dia_semana, :hora_inicio, :hora_fim, :modalidade)"
        ),
        linhas,
    )
    return len(linhas)
