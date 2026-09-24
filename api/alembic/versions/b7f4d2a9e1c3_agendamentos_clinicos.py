"""clinicas_parceiras + agendamentos_clinicos -- pedido de consulta real

Revision ID: b7f4d2a9e1c3
Revises: a8d3e5f1c2b7
Create Date: 2026-09-24 00:00:00.000000

Fecha um buraco real: o diálogo de marcação com a Optioptika (o único
parceiro clínico assinado) fabricava um "recibo" inteiramente no browser
(`OPT-${Date.now()...}`) e nunca saía dali -- nem a clínica nem a equipa
ficavam a saber que alguém tinha pedido uma consulta. O pitch deck já afirma
às clínicas que este agendamento "não é uma promessa de roadmap".

`clinicas_parceiras` é desenhada como identidade mínima (não o perfil
completo -- isso é fase 1 do roteiro em `docs/BACKLOG.md`, Sprint 4), para
`agendamentos_clinicos` nunca ficar preso a uma única clínica. Semeia-se já
a Optioptika, com os dados reais hoje hardcoded em
`frontend/src/data/optioptika.ts`.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "b7f4d2a9e1c3"
down_revision: Union[str, None] = "a8d3e5f1c2b7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "clinicas_parceiras",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("nome", sa.Text(), nullable=False),
        sa.Column("email_contacto", sa.Text(), nullable=False),
        sa.Column("telefone_contacto", sa.Text(), nullable=False),
        sa.Column("ativa", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "agendamentos_clinicos",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("clinica_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("utilizador_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("screening_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("nome", sa.Text(), nullable=False),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("telefone", sa.Text(), nullable=False),
        sa.Column("modalidade", sa.Text(), nullable=False),
        sa.Column("data_preferida", sa.Date(), nullable=True),
        sa.Column("periodo_preferido", sa.Text(), nullable=True),
        sa.Column("motivo", sa.Text(), nullable=True),
        sa.Column("estado", sa.Text(), server_default="pendente", nullable=False),
        sa.Column("decidido_por", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("decidido_em", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["clinica_id"], ["clinicas_parceiras.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["utilizador_id"], ["utilizadores.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["screening_id"], ["screenings.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["decidido_por"], ["utilizadores.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_agendamentos_clinicos_clinica_id"), "agendamentos_clinicos", ["clinica_id"]
    )
    op.create_index(
        op.f("ix_agendamentos_clinicos_utilizador_id"), "agendamentos_clinicos", ["utilizador_id"]
    )

    # Seed: o único parceiro clínico real e assinado hoje.
    op.execute(
        """
        INSERT INTO clinicas_parceiras (nome, email_contacto, telefone_contacto)
        VALUES ('Óptica Optioptika', 'geral@optioptika.com', '+244 931 240 304')
        """
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_agendamentos_clinicos_utilizador_id"), table_name="agendamentos_clinicos")
    op.drop_index(op.f("ix_agendamentos_clinicos_clinica_id"), table_name="agendamentos_clinicos")
    op.drop_table("agendamentos_clinicos")
    op.drop_table("clinicas_parceiras")
