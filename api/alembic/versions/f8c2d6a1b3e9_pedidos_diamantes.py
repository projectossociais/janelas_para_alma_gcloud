"""pedidos de diamantes pagos em Kwanzas (transferência + comprovativo, como o Premium)

Revision ID: f8c2d6a1b3e9
Revises: e5b1c8d2a4f7
Create Date: 2026-09-24 00:00:00.000000

Nova tabela `pedidos_diamantes`: um pedido por compra de um pacote da Loja
de Diamantes em Kwanzas. Mesmo fluxo do Premium -- o jogador transfere e
envia o comprovativo (R2, prefixo `comprovativos/`); um admin confirma o
pagamento e só então os diamantes são creditados, na mesma transacção que
marca o pedido como aprovado. Quantidade e preço ficam copiados do catálogo
no momento do pedido.

Downgrade apaga a tabela -- e com ela o histórico destes pedidos. Não correr
em produção depois de haver pedidos reais sem os exportar primeiro.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "f8c2d6a1b3e9"
down_revision: Union[str, None] = "e5b1c8d2a4f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "pedidos_diamantes",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("utilizador_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("pacote_id", sa.Text(), nullable=False),
        sa.Column("diamantes", sa.Integer(), nullable=False),
        sa.Column("preco_kz", sa.Integer(), nullable=False),
        sa.Column("comprovativo_url", sa.Text(), nullable=False),
        sa.Column("estado", sa.Text(), server_default="pendente", nullable=False),
        sa.Column("decidido_por", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("decidido_em", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("estado IN ('pendente', 'aprovado', 'rejeitado')", name="ck_pedidos_diamantes_estado"),
        sa.CheckConstraint("diamantes > 0", name="ck_pedidos_diamantes_diamantes_positivos"),
        sa.CheckConstraint("preco_kz > 0", name="ck_pedidos_diamantes_preco_positivo"),
        sa.ForeignKeyConstraint(["utilizador_id"], ["utilizadores.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["decidido_por"], ["utilizadores.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_pedidos_diamantes_utilizador_id", "pedidos_diamantes", ["utilizador_id"])


def downgrade() -> None:
    op.drop_index("ix_pedidos_diamantes_utilizador_id", table_name="pedidos_diamantes")
    op.drop_table("pedidos_diamantes")
