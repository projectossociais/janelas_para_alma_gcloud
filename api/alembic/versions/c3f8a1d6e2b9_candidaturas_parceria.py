"""candidaturas_parceria: registo de empresas parceiras

Revision ID: c3f8a1d6e2b9
Revises: c8f3a5d1e7b2
Create Date: 2026-11-10 00:00:00.000000

Formulário público `/parceiros/registo`: uma clínica, óptica ou organização
preenche os dados legais da empresa e do representante e pode anexar
documentos (chaves no bucket R2 privado, prefixo `parcerias/`). Substitui o
formulário curto que ia por um serviço externo (formsubmit.co) e não ficava
gravado em lado nenhum. Tabela nova; não toca em dados existentes.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "c3f8a1d6e2b9"
down_revision: Union[str, None] = "c8f3a5d1e7b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "candidaturas_parceria",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("referencia", sa.Text(), nullable=False),
        sa.Column("denominacao", sa.Text(), nullable=False),
        sa.Column("nif", sa.Text(), nullable=False),
        sa.Column("tipo", sa.Text(), nullable=False),
        sa.Column("provincia", sa.Text(), nullable=False),
        sa.Column("morada", sa.Text(), nullable=True),
        sa.Column("website", sa.Text(), nullable=True),
        sa.Column("representante_nome", sa.Text(), nullable=False),
        sa.Column("representante_cargo", sa.Text(), nullable=False),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("telefone", sa.Text(), nullable=False),
        sa.Column("mensagem", sa.Text(), nullable=True),
        sa.Column("documentos", postgresql.JSONB(), server_default="[]", nullable=False),
        sa.Column("estado", sa.Text(), server_default="pendente", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("referencia"),
    )


def downgrade() -> None:
    op.drop_table("candidaturas_parceria")
