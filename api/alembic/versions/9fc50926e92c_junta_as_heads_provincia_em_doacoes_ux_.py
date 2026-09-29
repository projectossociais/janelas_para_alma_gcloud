"""junta as heads: provincia em doacoes (UX-03, #113) e a migracao dos exercicios sem webcam

Revision ID: 9fc50926e92c
Revises: a7c2e5f9d1b3, b2c6e9a4d1f8
Create Date: 2026-09-29 07:08:39.428658

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '9fc50926e92c'
down_revision: Union[str, None] = ('a7c2e5f9d1b3', 'b2c6e9a4d1f8')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
