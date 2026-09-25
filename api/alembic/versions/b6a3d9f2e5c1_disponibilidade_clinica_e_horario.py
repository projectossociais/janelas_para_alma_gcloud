"""disponibilidade semanal da clínica + horário real no pedido de consulta

Revision ID: b6a3d9f2e5c1
Revises: a4d7e2c9f1b6
Create Date: 2026-09-25 00:00:00.000000

Fase 1, parte 3 (última), do matchmaker clínico (docs/BACKLOG.md, Sprint 4).

`disponibilidade_clinica` é um horário semanal recorrente simples, gerido
pela própria clínica no seu portal (`DashboardPro.tsx`) -- não um calendário
completo (ver "Riscos a não ignorar" do roteiro: over-engineering nesta
fase). `dia_semana` segue a convenção de `date.weekday()` do Python
(0 = segunda, 6 = domingo) -- a mesma usada em `AgendamentoClinicoService`
ao gerar horários concretos a partir destas janelas.

`agendamentos_clinicos.horario_inicio` guarda o instante exacto escolhido
pelo paciente (calculado a partir da disponibilidade acima, nunca texto
livre). `data_preferida`/`periodo_preferido` ficam para sempre nulos em
pedidos novos, mas não se apagam -- há pedidos reais já gravados só com
esses campos (Fase 0, PR #86), e apagar dados de um pedido de consulta real
não é uma migração aditiva inofensiva.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "b6a3d9f2e5c1"
down_revision: Union[str, None] = "a4d7e2c9f1b6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "disponibilidade_clinica",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("clinica_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("dia_semana", sa.SmallInteger(), nullable=False),
        sa.Column("hora_inicio", sa.Time(), nullable=False),
        sa.Column("hora_fim", sa.Time(), nullable=False),
        sa.Column("modalidade", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["clinica_id"], ["clinicas_parceiras.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint("dia_semana >= 0 AND dia_semana <= 6", name="ck_disponibilidade_clinica_dia_semana"),
    )
    op.create_index(
        op.f("ix_disponibilidade_clinica_clinica_id"), "disponibilidade_clinica", ["clinica_id"]
    )

    op.add_column("agendamentos_clinicos", sa.Column("horario_inicio", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("agendamentos_clinicos", "horario_inicio")
    op.drop_index(op.f("ix_disponibilidade_clinica_clinica_id"), table_name="disponibilidade_clinica")
    op.drop_table("disponibilidade_clinica")
