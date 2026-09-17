"""comprovativo_url em doacoes e premium_requests

Revision ID: 05db9b9b607c
Revises: 0140a7145adb
Create Date: 2026-09-17 00:00:00.000000

CROSS-02 -- o comprovativo de transferência/pagamento passa a ser um upload
directo ao R2 (mesmo padrão do avatar), em vez de ir só por email via uma
Edge Function do Supabase. Guarda-se o URL público, nunca os bytes.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "05db9b9b607c"
down_revision: Union[str, None] = "0140a7145adb"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("doacoes", sa.Column("comprovativo_url", sa.Text(), nullable=True))
    op.add_column("premium_requests", sa.Column("comprovativo_url", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("premium_requests", "comprovativo_url")
    op.drop_column("doacoes", "comprovativo_url")
