"""confirmacao de email (AUTH-02)

Revision ID: c7e4b8a1f6d3
Revises: a1f3c9e7d2b4
Create Date: 2026-09-14 00:00:00.000000

AUTH-02 — o registo deixa de fazer login automático; a conta nasce por
confirmar e /auth/entrar recusa login enquanto isso for verdade (bloqueio
total, decisão do dono do projecto). Ver docs/BACKLOG.md.

- `utilizadores.email_confirmado`: aditiva, `false` por omissão — nenhuma
  conta pré-existente precisa de migração de dados (base nasce vazia).
- `tokens_confirmacao_email`: mesmo desenho de `tokens_recuperacao_password`
  (migração a1f3c9e7d2b4) — hash do token, expiração, marca de uso único.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "c7e4b8a1f6d3"
down_revision: Union[str, None] = "a1f3c9e7d2b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TABELA = "tokens_confirmacao_email"
_FK = "fk_tokens_confirmacao_email_utilizador_id_utilizadores"


def upgrade() -> None:
    op.add_column(
        "utilizadores",
        sa.Column("email_confirmado", sa.Boolean(), server_default="false", nullable=False),
    )
    op.create_table(
        _TABELA,
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("utilizador_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("expira_em", sa.DateTime(timezone=True), nullable=False),
        sa.Column("usado_em", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index(op.f("ix_tokens_confirmacao_email_utilizador_id"), _TABELA, ["utilizador_id"])
    op.create_index(op.f("ix_tokens_confirmacao_email_token_hash"), _TABELA, ["token_hash"])
    op.create_foreign_key(_FK, _TABELA, "utilizadores", ["utilizador_id"], ["id"], ondelete="CASCADE")


def downgrade() -> None:
    op.drop_constraint(_FK, _TABELA, type_="foreignkey")
    op.drop_index(op.f("ix_tokens_confirmacao_email_token_hash"), table_name=_TABELA)
    op.drop_index(op.f("ix_tokens_confirmacao_email_utilizador_id"), table_name=_TABELA)
    op.drop_table(_TABELA)
    op.drop_column("utilizadores", "email_confirmado")
