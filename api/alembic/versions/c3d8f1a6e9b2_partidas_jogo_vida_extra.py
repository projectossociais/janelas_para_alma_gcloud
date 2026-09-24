"""partidas do jogo no servidor -- pergunta actual, vida extra, ajudas, sequências

Revision ID: c3d8f1a6e9b2
Revises: b9e4d2a7c1f5
Create Date: 2026-09-24 00:00:00.000000

Nova tabela `partidas_jogo`: uma linha por partida, com todo o estado que o
jogador podia querer inventar (a pergunta que o servidor lhe entregou,
patamares superados, sequência de acertos, vidas extra e ajudas usadas).
Índice único parcial: no máximo uma partida não terminada por utilizador.
Nova coluna `perfis_jogador.melhor_sequencia` (recorde de acertos seguidos).

Substitui `perfis_jogador.patamar_em_curso`, que é removida: guardava só o
progresso transitório da partida em curso. Quem estiver a meio de uma
partida no momento do deploy perde esse progresso (não o saldo nem as
estatísticas) -- recomeça do patamar 1.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "c3d8f1a6e9b2"
down_revision: Union[str, None] = "b9e4d2a7c1f5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "partidas_jogo",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("utilizador_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("estado", sa.Text(), server_default="em_curso", nullable=False),
        sa.Column("patamar_superado", sa.Integer(), server_default="0", nullable=False),
        sa.Column("vidas_extra_usadas", sa.Integer(), server_default="0", nullable=False),
        sa.Column("cinquenta_cinquenta_usada", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("opiniao_publico_usada", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("trocar_pergunta_usada", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("pergunta_atual_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("opcao_falhada", sa.Text(), nullable=True),
        sa.Column("sequencia_acertos", sa.Integer(), server_default="0", nullable=False),
        sa.Column("diamantes_sequencia", sa.Integer(), server_default="0", nullable=False),
        sa.Column("moedas_ganhas", sa.Integer(), nullable=True),
        sa.Column("diamantes_ganhos", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("terminada_em", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "estado IN ('em_curso', 'a_aguardar_decisao', 'terminada')", name="ck_partidas_jogo_estado"
        ),
        sa.CheckConstraint("patamar_superado BETWEEN 0 AND 15", name="ck_partidas_jogo_patamar_superado"),
        sa.ForeignKeyConstraint(["utilizador_id"], ["utilizadores.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_partidas_jogo_utilizador_id"), "partidas_jogo", ["utilizador_id"])
    op.create_index(
        "uq_partidas_jogo_uma_ativa_por_utilizador",
        "partidas_jogo",
        ["utilizador_id"],
        unique=True,
        postgresql_where=sa.text("estado <> 'terminada'"),
    )
    op.drop_column("perfis_jogador", "patamar_em_curso")
    op.add_column(
        "perfis_jogador",
        sa.Column("melhor_sequencia", sa.Integer(), server_default="0", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("perfis_jogador", "melhor_sequencia")
    op.add_column(
        "perfis_jogador",
        sa.Column("patamar_em_curso", sa.Integer(), server_default="0", nullable=False),
    )
    op.drop_index("uq_partidas_jogo_uma_ativa_por_utilizador", table_name="partidas_jogo")
    op.drop_index(op.f("ix_partidas_jogo_utilizador_id"), table_name="partidas_jogo")
    op.drop_table("partidas_jogo")
