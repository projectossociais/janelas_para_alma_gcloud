"""partidas do Multijogador Local do jogo

Revision ID: b4e7c2d9a1f6
Revises: a9d3f6b2e8c1
Create Date: 2026-11-10 00:00:00.000000

Nova tabela `partidas_locais_jogo`: uma linha por partida do Multijogador
Local (2 pessoas à vez no mesmo aparelho, na conta de quem tem sessão; o
CHECK aceita até 4, a regra dos 2 jogadores vive no service).
Guarda só o que decide o prémio em moedas -- a pergunta entregue e por
responder, as já entregues, quantas respondidas e quantas certas. Os nomes
e os pontos dos jogadores nunca saem do aparelho. Índice único parcial: no
máximo uma partida local em curso por utilizador.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "b4e7c2d9a1f6"
down_revision: Union[str, None] = "a9d3f6b2e8c1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "partidas_locais_jogo",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("utilizador_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("numero_jogadores", sa.Integer(), nullable=False),
        sa.Column("estado", sa.Text(), server_default="em_curso", nullable=False),
        sa.Column("pergunta_atual_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "perguntas_entregues",
            postgresql.ARRAY(postgresql.UUID(as_uuid=True)),
            server_default="{}",
            nullable=False,
        ),
        sa.Column("perguntas_respondidas", sa.Integer(), server_default="0", nullable=False),
        sa.Column("acertos", sa.Integer(), server_default="0", nullable=False),
        sa.Column("moedas_ganhas", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("terminada_em", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("estado IN ('em_curso', 'terminada')", name="ck_partidas_locais_jogo_estado"),
        sa.CheckConstraint("numero_jogadores BETWEEN 2 AND 4", name="ck_partidas_locais_jogo_jogadores"),
        sa.ForeignKeyConstraint(["utilizador_id"], ["utilizadores.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_partidas_locais_jogo_utilizador_id", "partidas_locais_jogo", ["utilizador_id"], unique=False
    )
    op.create_index(
        "uq_partidas_locais_jogo_uma_em_curso",
        "partidas_locais_jogo",
        ["utilizador_id"],
        unique=True,
        postgresql_where=sa.text("estado = 'em_curso'"),
    )


def downgrade() -> None:
    op.drop_index("uq_partidas_locais_jogo_uma_em_curso", table_name="partidas_locais_jogo")
    op.drop_index("ix_partidas_locais_jogo_utilizador_id", table_name="partidas_locais_jogo")
    op.drop_table("partidas_locais_jogo")
