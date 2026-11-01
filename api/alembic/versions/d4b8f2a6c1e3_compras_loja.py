"""compras feitas na app nativa (App Store / Google Play)

Revision ID: d4b8f2a6c1e3
Revises: b4e7d2a9c6f1
Create Date: 2026-10-30 00:00:00.000000

`compras_loja`: uma linha por transacção da loja, gravada pelo webhook do
RevenueCat (`CompraLojaService`). Índice único (loja, transacao_id) para a
mesma transacção nunca se aplicar duas vezes.

Downgrade apaga a tabela -- e com ela o registo das compras feitas nas lojas
(o Premium e o saldo já creditados ficam). Não correr em produção depois de
haver compras reais sem exportar a tabela primeiro.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "d4b8f2a6c1e3"
down_revision: Union[str, None] = "b4e7d2a9c6f1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "compras_loja",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("utilizador_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("loja", sa.Text(), nullable=False),
        sa.Column("ambiente", sa.Text(), nullable=False),
        sa.Column("produto_id", sa.Text(), nullable=False),
        sa.Column("tipo", sa.Text(), nullable=False),
        sa.Column("quantidade", sa.Integer(), nullable=True),
        sa.Column("premium_segundos", sa.Integer(), nullable=True),
        sa.Column("transacao_id", sa.Text(), nullable=False),
        sa.Column("transacao_original_id", sa.Text(), nullable=True),
        sa.Column("comprado_em", sa.DateTime(timezone=True), nullable=False),
        sa.Column("estado", sa.Text(), server_default="aplicada", nullable=False),
        sa.Column("reembolsada_em", sa.DateTime(timezone=True), nullable=True),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("loja IN ('app_store', 'play_store')", name="ck_compras_loja_loja"),
        sa.CheckConstraint("ambiente IN ('producao', 'sandbox')", name="ck_compras_loja_ambiente"),
        sa.CheckConstraint("tipo IN ('premium', 'diamantes', 'moedas')", name="ck_compras_loja_tipo"),
        sa.CheckConstraint("estado IN ('aplicada', 'reembolsada')", name="ck_compras_loja_estado"),
        sa.ForeignKeyConstraint(["utilizador_id"], ["utilizadores.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("loja", "transacao_id", name="uq_compras_loja_transacao"),
    )
    op.create_index("ix_compras_loja_utilizador_id", "compras_loja", ["utilizador_id"])


def downgrade() -> None:
    op.drop_index("ix_compras_loja_utilizador_id", table_name="compras_loja")
    op.drop_table("compras_loja")
