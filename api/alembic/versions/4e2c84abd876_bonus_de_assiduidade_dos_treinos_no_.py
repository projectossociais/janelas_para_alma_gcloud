"""bonus de assiduidade dos treinos no jogo (Fase B)

Revision ID: 4e2c84abd876
Revises: 9fc50926e92c
Create Date: 2026-09-29 00:00:00.000000

Decisão do dono do projecto (2026-09-29, docs/ANALISE_EXERCICIOS.md, Fase B):
100 moedas por dia com um treino que conta, mais 5 diamantes a cada 7 dias
seguidos. Uma linha por utilizador e por dia de Luanda; a chave única
(utilizador_id, dia) é a garantia de um só crédito por dia. Tabela nova,
aditiva -- o downgrade só a remove (não mexe em saldos já creditados).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "4e2c84abd876"
down_revision: Union[str, None] = "9fc50926e92c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "bonus_assiduidade_treino",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("utilizador_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("dia", sa.Date(), nullable=False),
        sa.Column("moedas", sa.Integer(), nullable=False),
        sa.Column("diamantes", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["utilizador_id"], ["utilizadores.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("utilizador_id", "dia", name="uq_bonus_assiduidade_utilizador_dia"),
    )
    op.create_index(
        "ix_bonus_assiduidade_treino_utilizador_id", "bonus_assiduidade_treino", ["utilizador_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_bonus_assiduidade_treino_utilizador_id", table_name="bonus_assiduidade_treino")
    op.drop_table("bonus_assiduidade_treino")
