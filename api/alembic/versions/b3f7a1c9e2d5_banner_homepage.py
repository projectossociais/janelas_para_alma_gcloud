"""banner-imagem da homepage

Revision ID: b3f7a1c9e2d5
Revises: 05db9b9b607c
Create Date: 2026-09-17 00:00:00.000000

Entidade nova, distinta de `banners` (a faixa fina de texto no topo de
todas as páginas, que se mantém tal e qual). `banners_homepage` é um
banner visual, com imagem, pensado para uma secção própria na homepage
(ADMIN-05) -- nasce sem `imagem_url`: a foto é sempre um upload em dois
passos à parte, depois de o banner já existir (mesmo padrão de
`Publicacao.capa_url`).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "b3f7a1c9e2d5"
down_revision: Union[str, None] = "05db9b9b607c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "banners_homepage",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("titulo", sa.Text(), nullable=False),
        sa.Column("descricao", sa.Text(), nullable=True),
        sa.Column("link", sa.Text(), nullable=True),
        sa.Column("imagem_url", sa.Text(), nullable=True),
        sa.Column("ativo", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("banners_homepage")
