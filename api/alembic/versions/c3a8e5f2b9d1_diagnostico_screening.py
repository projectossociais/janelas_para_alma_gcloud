"""diagnostico em screenings -- sinal real para o matchmaker clínico

Revision ID: c3a8e5f2b9d1
Revises: b7f4d2a9e1c3
Create Date: 2026-09-24 00:00:00.000000

Fase 1 do roteiro do matchmaker clínico (docs/BACKLOG.md, Sprint 4) pede
correspondência por tipo de diagnóstico. Antes desta migração, o diagnóstico
só existia no browser (sessionStorage, `Scanner.tsx`) -- nunca chegava ao
servidor. Só dois valores reais: `normal` / `requer_avaliacao`, os únicos
que o `janelas-scanner-api` de facto permite calcular hoje (não devolve
qual subtipo de estrabismo -- as 4 categorias que `ScannerResultados.tsx`
ainda mostra vêm do antigo Math.random(), removido no PR #61, e nunca são
atribuídas pelo cálculo real).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c3a8e5f2b9d1"
down_revision: Union[str, None] = "b7f4d2a9e1c3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "screenings",
        sa.Column("diagnostico", sa.Text(), server_default="normal", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("screenings", "diagnostico")
