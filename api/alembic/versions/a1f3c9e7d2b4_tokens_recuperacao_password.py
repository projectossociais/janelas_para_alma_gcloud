"""tokens de recuperacao de password

Revision ID: a1f3c9e7d2b4
Revises: 0becabba3bad
Create Date: 2026-09-13 00:00:00.000000

Suporte ao fluxo "esqueci-me da password" (fecha CROSS-04 / bloqueio #6 do
docs/BACKLOG.md), agora que o fornecedor de email (Resend) está decidido.

Tabela nova, aditiva — base de dados vazia, sem migração de dados. Guarda-se
o hash do token (nunca o valor em claro que vai por email), com expiração e
marca de uso — ver app/services/recuperacao_password_service.py.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "a1f3c9e7d2b4"
down_revision: Union[str, None] = "0becabba3bad"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TABELA = "tokens_recuperacao_password"
_FK = "fk_tokens_recuperacao_password_utilizador_id_utilizadores"


def upgrade() -> None:
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
    op.create_index(
        op.f("ix_tokens_recuperacao_password_utilizador_id"),
        _TABELA,
        ["utilizador_id"],
    )
    op.create_index(
        op.f("ix_tokens_recuperacao_password_token_hash"),
        _TABELA,
        ["token_hash"],
    )
    op.create_foreign_key(
        _FK,
        _TABELA,
        "utilizadores",
        ["utilizador_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint(_FK, _TABELA, type_="foreignkey")
    op.drop_index(op.f("ix_tokens_recuperacao_password_token_hash"), table_name=_TABELA)
    op.drop_index(op.f("ix_tokens_recuperacao_password_utilizador_id"), table_name=_TABELA)
    op.drop_table(_TABELA)
