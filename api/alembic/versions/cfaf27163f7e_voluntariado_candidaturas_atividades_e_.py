"""voluntariado: candidaturas, atividades e inscricoes

Revision ID: cfaf27163f7e
Revises: c7e4b8a1f6d3
Create Date: 2026-09-15 00:00:00.000000

Voluntariado passa a ser um estado ortogonal ao `papel`, mesmo desenho do
Premium (ver CLAUDE.md secção 0 e docs/BACKLOG.md): um profissional, um
estrábico ou uma pessoa comum podem todos ser voluntários sem deixar de ser
o que já são.

- `utilizadores.voluntario_ativo`: aditiva, `false` por omissão.
- `candidaturas_voluntariado`: pedido para se tornar voluntário, mesmo
  desenho de `premium_requests` (estado + auditoria de quem decidiu).
- `atividades_voluntariado`: o que um admin publica para os voluntários
  activos se inscreverem.
- `inscricoes_atividade`: a inscrição de um voluntário numa actividade,
  `UNIQUE(atividade_id, utilizador_id)` para nunca duplicar.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "cfaf27163f7e"
down_revision: Union[str, None] = "c7e4b8a1f6d3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "utilizadores",
        sa.Column("voluntario_ativo", sa.Boolean(), server_default="false", nullable=False),
    )

    op.create_table(
        "candidaturas_voluntariado",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("utilizador_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("motivacao", sa.Text(), nullable=False),
        sa.Column("telefone", sa.Text(), nullable=True),
        sa.Column("status", sa.Text(), server_default="pendente", nullable=False),
        sa.Column("decidido_por", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("decidido_em", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_candidaturas_voluntariado_utilizador_id"),
        "candidaturas_voluntariado",
        ["utilizador_id"],
    )
    op.create_foreign_key(
        "fk_candidaturas_voluntariado_utilizador_id_utilizadores",
        "candidaturas_voluntariado",
        "utilizadores",
        ["utilizador_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_candidaturas_voluntariado_decidido_por_utilizadores",
        "candidaturas_voluntariado",
        "utilizadores",
        ["decidido_por"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_table(
        "atividades_voluntariado",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("titulo", sa.Text(), nullable=False),
        sa.Column("descricao", sa.Text(), nullable=False),
        sa.Column("local", sa.Text(), nullable=False),
        sa.Column("data_inicio", sa.DateTime(timezone=True), nullable=False),
        sa.Column("data_fim", sa.DateTime(timezone=True), nullable=True),
        sa.Column("vagas", sa.Integer(), nullable=True),
        sa.Column("estado", sa.Text(), server_default="publicada", nullable=False),
        sa.Column("criado_por", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_foreign_key(
        "fk_atividades_voluntariado_criado_por_utilizadores",
        "atividades_voluntariado",
        "utilizadores",
        ["criado_por"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_table(
        "inscricoes_atividade",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("atividade_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("utilizador_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("estado", sa.Text(), server_default="inscrito", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("atividade_id", "utilizador_id", name="uq_inscricoes_atividade_utilizador"),
    )
    op.create_index(
        op.f("ix_inscricoes_atividade_atividade_id"), "inscricoes_atividade", ["atividade_id"]
    )
    op.create_index(
        op.f("ix_inscricoes_atividade_utilizador_id"), "inscricoes_atividade", ["utilizador_id"]
    )
    op.create_foreign_key(
        "fk_inscricoes_atividade_atividade_id_atividades_voluntariado",
        "inscricoes_atividade",
        "atividades_voluntariado",
        ["atividade_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_inscricoes_atividade_utilizador_id_utilizadores",
        "inscricoes_atividade",
        "utilizadores",
        ["utilizador_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_inscricoes_atividade_utilizador_id_utilizadores", "inscricoes_atividade", type_="foreignkey"
    )
    op.drop_constraint(
        "fk_inscricoes_atividade_atividade_id_atividades_voluntariado",
        "inscricoes_atividade",
        type_="foreignkey",
    )
    op.drop_index(op.f("ix_inscricoes_atividade_utilizador_id"), table_name="inscricoes_atividade")
    op.drop_index(op.f("ix_inscricoes_atividade_atividade_id"), table_name="inscricoes_atividade")
    op.drop_table("inscricoes_atividade")

    op.drop_constraint(
        "fk_atividades_voluntariado_criado_por_utilizadores", "atividades_voluntariado", type_="foreignkey"
    )
    op.drop_table("atividades_voluntariado")

    op.drop_constraint(
        "fk_candidaturas_voluntariado_decidido_por_utilizadores",
        "candidaturas_voluntariado",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_candidaturas_voluntariado_utilizador_id_utilizadores",
        "candidaturas_voluntariado",
        type_="foreignkey",
    )
    op.drop_index(
        op.f("ix_candidaturas_voluntariado_utilizador_id"), table_name="candidaturas_voluntariado"
    )
    op.drop_table("candidaturas_voluntariado")

    op.drop_column("utilizadores", "voluntario_ativo")
