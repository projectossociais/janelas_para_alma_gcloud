"""perguntas do jogo "Você Sabia Que..."

Revision ID: d4a8b2f1e6c7
Revises: b3f7a1c9e2d5
Create Date: 2026-09-21 00:00:00.000000

Tabela nova para o quiz estilo Quem Quer Ser Milionário. `resposta_correta`
fica de fora de qualquer esquema Pydantic enviado ao frontend antes da
validação (ver app/schemas/jogo.py) -- a base de dados é só metade da
garantia, a outra metade é nunca serializar o campo em `PerguntaPublica`.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "d4a8b2f1e6c7"
down_revision: Union[str, None] = "b3f7a1c9e2d5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

RESPOSTA_OPCAO_VALUES = ("A", "B", "C", "D")


def upgrade() -> None:
    # Criado à parte, com checkfirst -- e depois referenciado com
    # create_type=False na coluna. Sem isto, create_table() tenta criar o
    # tipo *outra vez* sozinho e a migração falha com "type already exists".
    resposta_opcao = postgresql.ENUM(*RESPOSTA_OPCAO_VALUES, name="resposta_opcao")
    resposta_opcao.create(op.get_bind(), checkfirst=True)
    resposta_coluna_enum = postgresql.ENUM(*RESPOSTA_OPCAO_VALUES, name="resposta_opcao", create_type=False)

    op.create_table(
        "perguntas_jogo",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("texto_pergunta", sa.Text(), nullable=False),
        sa.Column("opcao_a", sa.Text(), nullable=False),
        sa.Column("opcao_b", sa.Text(), nullable=False),
        sa.Column("opcao_c", sa.Text(), nullable=False),
        sa.Column("opcao_d", sa.Text(), nullable=False),
        sa.Column("resposta_correta", resposta_coluna_enum, nullable=False),
        sa.Column("nivel_dificuldade", sa.Integer(), nullable=False),
        sa.Column("explicacao", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("nivel_dificuldade BETWEEN 1 AND 3", name="ck_perguntas_jogo_nivel_dificuldade"),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("perguntas_jogo")
    postgresql.ENUM(*RESPOSTA_OPCAO_VALUES, name="resposta_opcao").drop(op.get_bind(), checkfirst=True)
