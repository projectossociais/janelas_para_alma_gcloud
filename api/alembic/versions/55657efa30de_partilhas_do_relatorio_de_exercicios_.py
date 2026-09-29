"""partilhas do relatorio de exercicios com o medico (Fase B)

Revision ID: 55657efa30de
Revises: 4e2c84abd876
Create Date: 2026-09-29 00:00:00.000000

Decisão do dono do projecto (2026-09-29, docs/ANALISE_EXERCICIOS.md, Fase B):
o relatório chega ao médico por um link temporário que o próprio pai gera e
envia -- nunca por envio automático. Guarda-se só o hash do token; válido 30
dias e revogável. Tabela nova, aditiva.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "55657efa30de"
down_revision: Union[str, None] = "4e2c84abd876"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "partilhas_relatorio",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("utilizador_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("expira_em", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revogado_em", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["utilizador_id"], ["utilizadores.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash", name="uq_partilhas_relatorio_token_hash"),
    )
    op.create_index("ix_partilhas_relatorio_utilizador_id", "partilhas_relatorio", ["utilizador_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_partilhas_relatorio_utilizador_id", table_name="partilhas_relatorio")
    op.drop_table("partilhas_relatorio")
