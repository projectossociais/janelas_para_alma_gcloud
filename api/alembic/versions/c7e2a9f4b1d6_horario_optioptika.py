"""horário semanal da Optioptika (Seg–Qui 08h–17h, Sáb 08h–13h)

Revision ID: c7e2a9f4b1d6
Revises: d4b8f2a6c1e3
Create Date: 2026-11-07 00:00:00.000000

Só dados, nenhuma mudança de esquema. A Optioptika nunca registou janelas em
`disponibilidade_clinica`, por isso o diálogo de marcação mostrava sempre
"Sem horários disponíveis nos próximos dias". Semeia o horário que a clínica
publica no perfil, presencial e online -- ver `app/repositories/horario_optioptika.py`.

Idempotente e não destrutivo: não faz nada se a clínica não existir ou se já
tiver qualquer janela registada (definida por ela no portal).

Downgrade apaga só as linhas que coincidem exactamente com as semeadas aqui.
"""

from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

from app.repositories.horario_optioptika import NOME_CLINICA, linhas_a_semear, semear_horario_optioptika

revision: str = "c7e2a9f4b1d6"
down_revision: Union[str, None] = "d4b8f2a6c1e3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    semear_horario_optioptika(op.get_bind())


def downgrade() -> None:
    conexao = op.get_bind()
    clinica_id = conexao.execute(
        text("SELECT id FROM clinicas_parceiras WHERE nome = :nome ORDER BY created_at LIMIT 1"),
        {"nome": NOME_CLINICA},
    ).scalar()
    if clinica_id is None:
        return
    conexao.execute(
        text(
            "DELETE FROM disponibilidade_clinica WHERE clinica_id = :clinica_id AND dia_semana = :dia_semana "
            "AND hora_inicio = :hora_inicio AND hora_fim = :hora_fim AND modalidade = :modalidade"
        ),
        linhas_a_semear(clinica_id),
    )
