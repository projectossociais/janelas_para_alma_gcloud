"""trial de 7 dias aos exercícios -- trial_iniciado_em / trial_termina_em

Revision ID: a8d3e5f1c2b7
Revises: f2a9c6e1b8d4
Create Date: 2026-09-23 12:00:00.000000

Os 8 exercícios passam a ser todos pagos; o trial dá 7 dias de acesso aos 4
exercícios base, uma única vez por conta. As duas colunas nascem NULL em
todas as contas existentes -- NULL significa "trial disponível, ainda não
iniciado", por isso ninguém perde acesso sem ter podido testar e não há
nenhum UPDATE de dados aqui. Guardadas em UTC (timestamptz).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a8d3e5f1c2b7"
down_revision: Union[str, None] = "f2a9c6e1b8d4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "utilizadores",
        sa.Column("trial_iniciado_em", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "utilizadores",
        sa.Column("trial_termina_em", sa.DateTime(timezone=True), nullable=True),
    )
    # Os dois vivem juntos: ou o trial nunca foi iniciado (ambos NULL), ou
    # foi, e então tem fim. Um estado a meio seria um bug no service.
    op.create_check_constraint(
        "ck_utilizadores_trial_consistente",
        "utilizadores",
        "(trial_iniciado_em IS NULL) = (trial_termina_em IS NULL)",
    )


def downgrade() -> None:
    op.drop_constraint("ck_utilizadores_trial_consistente", "utilizadores", type_="check")
    op.drop_column("utilizadores", "trial_termina_em")
    op.drop_column("utilizadores", "trial_iniciado_em")
