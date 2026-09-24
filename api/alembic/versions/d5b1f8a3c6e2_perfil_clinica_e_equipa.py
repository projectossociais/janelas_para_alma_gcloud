"""perfil de clínica mais rico + equipa_clinica (login próprio da clínica)

Revision ID: d5b1f8a3c6e2
Revises: e5b1c8d2a4f7
Create Date: 2026-09-24 00:00:00.000000

Fase 1, parte 2, do matchmaker clínico (docs/BACKLOG.md, Sprint 4).

`papel: "profissional"` já é auto-registável sem verificação nenhuma
(`PAPEIS_AUTO_REGISTAVEIS` em schemas/auth.py) -- por isso o acesso ao
portal da clínica nunca pode vir directamente desse papel. `equipa_clinica`
é a única coisa que dá acesso: uma linha só nasce por acção explícita de um
admin (`POST /admin/clinicas/{id}/equipa`), nunca pelo próprio utilizador.
`utilizador_id` é UNIQUE -- uma conta pertence, no máximo, a uma clínica
nesta fase (suficiente enquanto só a Optioptika existe).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "d5b1f8a3c6e2"
down_revision: Union[str, None] = "e5b1c8d2a4f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "clinicas_parceiras",
        sa.Column("especialidades", postgresql.ARRAY(sa.Text()), server_default="{}", nullable=False),
    )
    op.add_column("clinicas_parceiras", sa.Column("cidade", sa.Text(), nullable=True))
    op.add_column(
        "clinicas_parceiras",
        sa.Column("modalidades_suportadas", postgresql.ARRAY(sa.Text()), server_default="{}", nullable=False),
    )
    op.add_column("clinicas_parceiras", sa.Column("preco_indicativo", sa.Text(), nullable=True))

    op.execute(
        "UPDATE clinicas_parceiras SET modalidades_suportadas = '{presencial,online}', "
        "cidade = 'Luanda' WHERE nome = 'Óptica Optioptika'"
    )

    op.create_table(
        "equipa_clinica",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("utilizador_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("clinica_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["utilizador_id"], ["utilizadores.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["clinica_id"], ["clinicas_parceiras.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("utilizador_id"),
    )
    op.create_index(op.f("ix_equipa_clinica_clinica_id"), "equipa_clinica", ["clinica_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_equipa_clinica_clinica_id"), table_name="equipa_clinica")
    op.drop_table("equipa_clinica")
    op.drop_column("clinicas_parceiras", "preco_indicativo")
    op.drop_column("clinicas_parceiras", "modalidades_suportadas")
    op.drop_column("clinicas_parceiras", "cidade")
    op.drop_column("clinicas_parceiras", "especialidades")
