"""apoio mensal (Kamba Mensal) e gostos/visualizações das publicações

Revision ID: c7a3e1f9d2b4
Revises: d4b8f2a6c1e3
Create Date: 2026-10-26 00:00:00.000000

Redesenho da página inicial e da navegação (2026-10-26):

- `apoios_mensais`: a promessa de doação mensal de uma conta. Não há débito
  automático: cada comprovativo mensal é uma linha normal de `doacoes`
  (financeira), agora com `doacoes.apoio_mensal_id` a ligá-la ao apoio. No
  máximo um apoio `ativo` por utilizador (índice único parcial).
- `publicacoes.visualizacoes`: contador da página pública.
- `gostos_publicacao`: um gosto por conta e por publicação (chave composta).

Downgrade apaga as duas tabelas, a coluna e a ligação -- e com elas o
histórico de apoios mensais e de gostos (os comprovativos continuam em
`doacoes`, sem a ligação). Não correr em produção depois de haver dados
reais sem os exportar primeiro.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "c7a3e1f9d2b4"
down_revision: Union[str, None] = "d4b8f2a6c1e3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "apoios_mensais",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("utilizador_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("valor_mensal_kz", sa.Integer(), nullable=False),
        sa.Column("estado", sa.Text(), server_default="ativo", nullable=False),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("cancelado_em", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ultimo_comprovativo_em", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ultimo_lembrete_em", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("estado IN ('ativo', 'cancelado')", name="ck_apoios_mensais_estado"),
        sa.CheckConstraint("valor_mensal_kz > 0", name="ck_apoios_mensais_valor_positivo"),
        sa.ForeignKeyConstraint(["utilizador_id"], ["utilizadores.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_apoios_mensais_utilizador_id", "apoios_mensais", ["utilizador_id"])
    op.create_index(
        "uq_apoios_mensais_um_ativo_por_utilizador",
        "apoios_mensais",
        ["utilizador_id"],
        unique=True,
        postgresql_where=sa.text("estado = 'ativo'"),
    )

    op.add_column("doacoes", sa.Column("apoio_mensal_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_doacoes_apoio_mensal_id", "doacoes", "apoios_mensais", ["apoio_mensal_id"], ["id"], ondelete="SET NULL"
    )
    op.create_index("ix_doacoes_apoio_mensal_id", "doacoes", ["apoio_mensal_id"])

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
    op.drop_index("ix_doacoes_apoio_mensal_id", table_name="doacoes")
    op.drop_constraint("fk_doacoes_apoio_mensal_id", "doacoes", type_="foreignkey")
    op.drop_column("doacoes", "apoio_mensal_id")
    op.drop_index("uq_apoios_mensais_um_ativo_por_utilizador", table_name="apoios_mensais")
    op.drop_index("ix_apoios_mensais_utilizador_id", table_name="apoios_mensais")
    op.drop_table("apoios_mensais")
