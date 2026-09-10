"""premium: ativacao e auditoria (W-11)

Revision ID: 0becabba3bad
Revises: 6318271fa98f
Create Date: 2026-09-10 03:35:09.490996

W-11 — confirmação de pagamento activa o Premium. Ver docs/BACKLOG.md.

- `utilizadores.premium_ativo` / `premium_expira_em`: estado da subscrição,
  ortogonal ao `papel`. A expiração é verificada na leitura (sem job).
- `premium_requests.aprovado_por` / `aprovado_em`: auditoria de quem aprovou
  o pagamento e quando.

Colunas aditivas, base de dados vazia — sem migração de dados.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0becabba3bad"
down_revision: Union[str, None] = "6318271fa98f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_FK_APROVADO_POR = "fk_premium_requests_aprovado_por_utilizadores"


def upgrade() -> None:
    op.add_column(
        "utilizadores",
        sa.Column("premium_ativo", sa.Boolean(), server_default="false", nullable=False),
    )
    op.add_column(
        "utilizadores",
        sa.Column("premium_expira_em", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "premium_requests", sa.Column("aprovado_por", sa.UUID(), nullable=True)
    )
    op.add_column(
        "premium_requests",
        sa.Column("aprovado_em", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_foreign_key(
        _FK_APROVADO_POR,
        "premium_requests",
        "utilizadores",
        ["aprovado_por"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(_FK_APROVADO_POR, "premium_requests", type_="foreignkey")
    op.drop_column("premium_requests", "aprovado_em")
    op.drop_column("premium_requests", "aprovado_por")
    op.drop_column("utilizadores", "premium_expira_em")
    op.drop_column("utilizadores", "premium_ativo")
