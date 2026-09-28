"""anonimizado_em em utilizadores -- eliminação real de contas (W-03)

Revision ID: f3c8a1e6b9d4
Revises: d2e8a5c1f3b7
Create Date: 2026-09-28 00:00:00.000000

`eliminar_agendado_para` já existia (agenda a eliminação a 30 dias), mas
nada processava esse prazo -- confirmado na auditoria do backlog de
2026-09-28. Decisão do dono do projecto: **anonimizar, não apagar a linha**.
Apagar `utilizadores` em cascata destruiria histórico clínico real
(`screenings`, `sessoes_exercicio`, etc., todos `ON DELETE CASCADE` para
`utilizadores.id`) que não tem de desaparecer só porque a identidade da
pessoa desaparece. `anonimizado_em` marca que a linha já foi processada
(nunca se reprocessa duas vezes) -- ver `services/eliminacao_conta_service.py`.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f3c8a1e6b9d4"
down_revision: Union[str, None] = "d2e8a5c1f3b7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("utilizadores", sa.Column("anonimizado_em", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("utilizadores", "anonimizado_em")
