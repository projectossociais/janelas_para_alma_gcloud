"""bloqueios dos vendedores do Mercado do jogo (cooldown de 4h por jogador)

Revision ID: b9e4d2a7c1f5
Revises: c3a8e5f2b9d1
Create Date: 2026-09-24 00:00:00.000000

Ajuda paga "Mercado" do jogo "Inclusivamente": cada vendedor ambulante vende
uma sugestão de resposta por diamantes e fica bloqueado para esse jogador
durante 4 horas. O bloqueio é guardado no servidor (nunca no browser, onde
bastaria limpar o localStorage para o contornar). Uma linha por par
(utilizador, vendedor), actualizada a cada compra -- `UNIQUE` é o que deixa
`MercadoJogoRepository.debitar_e_bloquear` fazer o upsert condicional que
impede duas compras simultâneas ao mesmo vendedor.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "b9e4d2a7c1f5"
down_revision: Union[str, None] = "c3a8e5f2b9d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "bloqueios_vendedores_jogo",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("utilizador_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("vendedor_id", sa.Text(), nullable=False),
        sa.Column("disponivel_em", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["utilizador_id"], ["utilizadores.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "utilizador_id", "vendedor_id", name="uq_bloqueios_vendedores_jogo_utilizador_vendedor"
        ),
    )
    op.create_index(
        op.f("ix_bloqueios_vendedores_jogo_utilizador_id"), "bloqueios_vendedores_jogo", ["utilizador_id"]
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_bloqueios_vendedores_jogo_utilizador_id"), table_name="bloqueios_vendedores_jogo")
    op.drop_table("bloqueios_vendedores_jogo")
