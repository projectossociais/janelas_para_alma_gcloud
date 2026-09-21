"""perfil do jogador -- moedas, diamantes e estatísticas

Revision ID: e7c1a4d9f3b6
Revises: d4a8b2f1e6c7
Create Date: 2026-09-21 00:00:00.000000

Uma linha por utilizador (`UNIQUE` em `utilizador_id`) com o saldo da
economia virtual do jogo "Você Sabia Que...". Nasce lazily -- só quando o
utilizador toca em `/jogo/perfil` ou `/jogo/recompensas` pela primeira vez,
nunca no registo da conta.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "e7c1a4d9f3b6"
down_revision: Union[str, None] = "d4a8b2f1e6c7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "perfis_jogador",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("utilizador_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("moedas", sa.Integer(), server_default="0", nullable=False),
        sa.Column("diamantes", sa.Integer(), server_default="0", nullable=False),
        sa.Column("partidas_jogadas", sa.Integer(), server_default="0", nullable=False),
        sa.Column("patamar_maximo_alcancado", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["utilizador_id"], ["utilizadores.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("utilizador_id"),
    )
    op.create_index(op.f("ix_perfis_jogador_utilizador_id"), "perfis_jogador", ["utilizador_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_perfis_jogador_utilizador_id"), table_name="perfis_jogador")
    op.drop_table("perfis_jogador")
