"""exercícios de visão sem webcam: resultados por olho em sessoes_exercicio e
calibração/perfil visual em utilizadores

Revision ID: b2c6e9a4d1f8
Revises: f3c8a1e6b9d4
Create Date: 2026-09-28 12:00:00.000000

Os exercícios deixaram de usar webcam/MediaPipe (decisão do dono do projecto,
2026-09-28): passam a ser testes de triagem e treinos com resposta do
utilizador. Os 8 ids de `sessoes_exercicio.exercicio_id` mantêm-se (o acesso
trial/Premium não muda), mas quatro mudam de significado -- `versao`
distingue as sessões antigas (1, o valor de todas as linhas que já existem)
das novas (2). Ver `services/acesso_exercicios_service.py`.

Todas as colunas novas são opcionais: nenhuma sessão antiga fica inválida.
Sem dados pessoais novos além do perfil visual que o próprio utilizador
escolhe preencher (olho mais fraco, óculos, faixa etária); a anonimização de
contas (W-03) limpa-os.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "b2c6e9a4d1f8"
down_revision: Union[str, None] = "f3c8a1e6b9d4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("sessoes_exercicio", sa.Column("versao", sa.SmallInteger(), nullable=False, server_default="1"))
    op.add_column("sessoes_exercicio", sa.Column("olho", sa.Text(), nullable=True))
    op.add_column("sessoes_exercicio", sa.Column("segundos_activos", sa.Integer(), nullable=True))
    op.add_column("sessoes_exercicio", sa.Column("limiar", sa.Numeric(), nullable=True))
    op.add_column("sessoes_exercicio", sa.Column("unidade", sa.Text(), nullable=True))
    op.add_column("sessoes_exercicio", sa.Column("distancia_mm", sa.Integer(), nullable=True))
    op.add_column("sessoes_exercicio", sa.Column("px_por_mm", sa.Numeric(), nullable=True))
    op.add_column("sessoes_exercicio", sa.Column("calibrado", sa.Boolean(), nullable=True))
    op.add_column("sessoes_exercicio", sa.Column("sinais", postgresql.JSONB(), nullable=True))
    op.create_check_constraint(
        "ck_sessoes_exercicio_olho",
        "sessoes_exercicio",
        "olho IS NULL OR olho IN ('direito', 'esquerdo', 'ambos')",
    )
    op.create_index(
        "ix_sessoes_exercicio_user_id_created_at",
        "sessoes_exercicio",
        ["user_id", "created_at"],
    )

    op.add_column("utilizadores", sa.Column("px_por_mm", sa.Numeric(), nullable=True))
    op.add_column("utilizadores", sa.Column("olho_mais_fraco", sa.Text(), nullable=True))
    op.add_column("utilizadores", sa.Column("usa_oculos", sa.Boolean(), nullable=True))
    op.add_column("utilizadores", sa.Column("faixa_etaria", sa.Text(), nullable=True))
    op.create_check_constraint(
        "ck_utilizadores_olho_mais_fraco",
        "utilizadores",
        "olho_mais_fraco IS NULL OR olho_mais_fraco IN ('direito', 'esquerdo', 'nao_sei')",
    )
    op.create_check_constraint(
        "ck_utilizadores_faixa_etaria",
        "utilizadores",
        "faixa_etaria IS NULL OR faixa_etaria IN ('ate_5', '6_12', '13_17', '18_39', '40_59', '60_mais')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_utilizadores_faixa_etaria", "utilizadores", type_="check")
    op.drop_constraint("ck_utilizadores_olho_mais_fraco", "utilizadores", type_="check")
    op.drop_column("utilizadores", "faixa_etaria")
    op.drop_column("utilizadores", "usa_oculos")
    op.drop_column("utilizadores", "olho_mais_fraco")
    op.drop_column("utilizadores", "px_por_mm")

    op.drop_index("ix_sessoes_exercicio_user_id_created_at", table_name="sessoes_exercicio")
    op.drop_constraint("ck_sessoes_exercicio_olho", "sessoes_exercicio", type_="check")
    for coluna in (
        "sinais",
        "calibrado",
        "px_por_mm",
        "distancia_mm",
        "unidade",
        "limiar",
        "segundos_activos",
        "olho",
        "versao",
    ):
        op.drop_column("sessoes_exercicio", coluna)
