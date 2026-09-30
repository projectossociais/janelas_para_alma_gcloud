"""consentimentos para tratar dados de saude (Lei 22/11, art. 13.º e 14.º)

Revision ID: a7d3e9c1f5b2
Revises: 55657efa30de
Create Date: 2026-09-30 00:00:00.000000

Dados de saúde são sensíveis e exigem consentimento expresso e escrito do
titular ou do representante legal. Sem jurista no projecto (decisão do dono,
2026-09-30), fica um registo por aceitação, com a versão do texto e a
declaração de maioridade. Tabela nova, aditiva.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "a7d3e9c1f5b2"
down_revision: Union[str, None] = "55657efa30de"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "consentimentos_dados_saude",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("utilizador_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("versao", sa.String(length=20), nullable=False),
        sa.Column("declara_maioridade", sa.Boolean(), nullable=False),
        sa.Column("representa_menor", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("aceite_em", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("revogado_em", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["utilizador_id"], ["utilizadores.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_consentimentos_dados_saude_utilizador_id", "consentimentos_dados_saude", ["utilizador_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_consentimentos_dados_saude_utilizador_id", table_name="consentimentos_dados_saude")
    op.drop_table("consentimentos_dados_saude")
