"""gostos e visualizações das publicações

Revision ID: a9d3f6b2e8c1
Revises: c7e2a9f4b1d6
Create Date: 2026-11-10 00:00:00.000000

O frontend já mostra visualizações e "Gosto" nas publicações (2026-10-26),
mas a API ainda não tinha onde os guardar:

- `publicacoes.visualizacoes`: contador da página pública.
- `gostos_publicacao`: um gosto por conta e por publicação (chave composta).

Downgrade apaga a coluna e a tabela, e com elas os contadores e os gostos.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "a9d3f6b2e8c1"
down_revision: Union[str, None] = "c7e2a9f4b1d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("publicacoes", sa.Column("visualizacoes", sa.Integer(), server_default="0", nullable=False))

    op.create_table(
        "gostos_publicacao",
        sa.Column("publicacao_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("utilizador_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["publicacao_id"], ["publicacoes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["utilizador_id"], ["utilizadores.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("publicacao_id", "utilizador_id"),
    )
    op.create_index("ix_gostos_publicacao_utilizador_id", "gostos_publicacao", ["utilizador_id"])


def downgrade() -> None:
    op.drop_index("ix_gostos_publicacao_utilizador_id", table_name="gostos_publicacao")
    op.drop_table("gostos_publicacao")
    op.drop_column("publicacoes", "visualizacoes")
