"""teleconsultas -- ciclo de vida da consulta online (Fase 2 do matchmaker)

Revision ID: d2e8a5c1f3b7
Revises: b6a3d9f2e5c1
Create Date: 2026-09-25 00:00:00.000000

Fase 2 do matchmaker clínico (docs/BACKLOG.md, Sprint 4). Decisão do dono do
projecto (2026-09-25): sem orçamento para Daily.co/100ms -- usa-se o Jitsi
Meet (`meet.jit.si`), servidor público e gratuito da 8x8, através de um link
de sala aberto numa aba nova (nunca embutido via IFrame API, que tem um
limite de 5 minutos no modo embutido). `sala_video` guarda só o nome da
sala (não o URL completo), para o domínio do fornecedor poder mudar sem
migração de dados.

Uma `teleconsulta` só existe para um `agendamento_clinico` com
`modalidade = "online"` já confirmado -- nasce nesse momento
(`AgendamentoClinicoService.confirmar`), nunca antes.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "d2e8a5c1f3b7"
down_revision: Union[str, None] = "b6a3d9f2e5c1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "teleconsultas",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("agendamento_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sala_video", sa.Text(), nullable=False),
        sa.Column("estado", sa.Text(), nullable=False, server_default="agendada"),
        sa.Column("iniciada_em", sa.DateTime(timezone=True), nullable=True),
        sa.Column("concluida_em", sa.DateTime(timezone=True), nullable=True),
        sa.Column("recomendacao_clinica", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["agendamento_id"], ["agendamentos_clinicos.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("agendamento_id"),
    )


def downgrade() -> None:
    op.drop_table("teleconsultas")
