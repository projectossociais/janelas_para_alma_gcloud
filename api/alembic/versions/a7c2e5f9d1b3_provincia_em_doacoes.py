"""provincia em doacoes -- onde recolher materiais doados (UX-03)

Revision ID: a7c2e5f9d1b3
Revises: f3c8a1e6b9d4
Create Date: 2026-09-29 00:00:00.000000

Sem esta coluna a equipa não sabia onde ir recolher o que foi doado
(confirmado na auditoria do backlog de 2026-09-28). Nullable: só doações
de materiais a preenchem (obrigatório nesse formulário, ver
`DoacaoMateriaisCriar`), doações financeiras não precisam de recolha e
linhas antigas nunca tiveram este campo.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a7c2e5f9d1b3"
down_revision: Union[str, None] = "f3c8a1e6b9d4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("doacoes", sa.Column("provincia", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("doacoes", "provincia")
