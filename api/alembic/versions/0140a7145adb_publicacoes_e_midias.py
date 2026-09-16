"""publicacoes e midias

Revision ID: 0140a7145adb
Revises: cfaf27163f7e
Create Date: 2026-09-16 00:00:00.000000

ADMIN-03 -- substitui o padrão de "cada campanha nova é uma página React
escrita por um programador" (ver `ActivitiesFeed.tsx`/`CampanhaGamek.tsx`)
por um CMS real, gerido no painel de administração: título, resumo, corpo,
data, local, capa e uma galeria de fotos, com estado rascunho/publicado e
uma única página pública dinâmica por publicação.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0140a7145adb"
down_revision: Union[str, None] = "cfaf27163f7e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "publicacoes",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("slug", sa.Text(), nullable=False),
        sa.Column("titulo", sa.Text(), nullable=False),
        sa.Column("resumo", sa.Text(), nullable=False),
        sa.Column("corpo", sa.Text(), nullable=False),
        sa.Column("local", sa.Text(), nullable=True),
        sa.Column("data_evento", sa.Date(), nullable=True),
        sa.Column("capa_url", sa.Text(), nullable=True),
        sa.Column("estado", sa.Text(), server_default="rascunho", nullable=False),
        sa.Column("criado_por", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index(op.f("ix_publicacoes_slug"), "publicacoes", ["slug"])
    op.create_foreign_key(
        "fk_publicacoes_criado_por_utilizadores",
        "publicacoes",
        "utilizadores",
        ["criado_por"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_table(
        "midias_publicacao",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("publicacao_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("ordem", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_midias_publicacao_publicacao_id"), "midias_publicacao", ["publicacao_id"])
    op.create_foreign_key(
        "fk_midias_publicacao_publicacao_id_publicacoes",
        "midias_publicacao",
        "publicacoes",
        ["publicacao_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_midias_publicacao_publicacao_id_publicacoes", "midias_publicacao", type_="foreignkey"
    )
    op.drop_index(op.f("ix_midias_publicacao_publicacao_id"), table_name="midias_publicacao")
    op.drop_table("midias_publicacao")

    op.drop_constraint("fk_publicacoes_criado_por_utilizadores", "publicacoes", type_="foreignkey")
    op.drop_index(op.f("ix_publicacoes_slug"), table_name="publicacoes")
    op.drop_table("publicacoes")
