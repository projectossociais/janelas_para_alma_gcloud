"""alinha a baseline com os modelos ORM

Revision ID: 6318271fa98f
Revises: 202609090001
Create Date: 2026-09-10 03:34:03.382040

A migração baseline (`202609090001`) foi escrita à mão sem Postgres real para
a validar (Docker não estava disponível — ver docs/BACKLOG.md, Sprint 0).
Ao correr `alembic upgrade head` + `alembic check` contra um Postgres a
sério pela primeira vez, apareceram duas diferenças em relação a
`orm_models.py`:

1. `admin_permissions.user_id` — o ORM declara-a NOT NULL (é `Mapped[UUID]`,
   não opcional); a baseline deixou-a nullable.
2. `utilizadores.email` — o ORM pede um único índice único
   (`unique=True, index=True` → um só `ix_utilizadores_email` unique). A
   baseline criou um índice **não**-único mais uma `UniqueConstraint`
   separada (`utilizadores_email_key`).

Base de dados nasce vazia, por isso pôr a coluna NOT NULL e trocar o índice
não mexe em dados nenhuns.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "6318271fa98f"
down_revision: Union[str, None] = "202609090001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("admin_permissions", "user_id", existing_type=sa.UUID(), nullable=False)
    op.drop_constraint(op.f("utilizadores_email_key"), "utilizadores", type_="unique")
    op.drop_index(op.f("ix_utilizadores_email"), table_name="utilizadores")
    op.create_index(op.f("ix_utilizadores_email"), "utilizadores", ["email"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_utilizadores_email"), table_name="utilizadores")
    op.create_index(op.f("ix_utilizadores_email"), "utilizadores", ["email"], unique=False)
    op.create_unique_constraint(op.f("utilizadores_email_key"), "utilizadores", ["email"])
    op.alter_column("admin_permissions", "user_id", existing_type=sa.UUID(), nullable=True)
