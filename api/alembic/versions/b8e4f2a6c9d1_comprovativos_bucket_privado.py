"""comprovativos de pagamento no bucket privado (comprovativo_chave)

Revision ID: b8e4f2a6c9d1
Revises: a7d3e9c1f5b2
Create Date: 2026-10-14 00:00:00.000000

Os comprovativos (Premium, doações, loja do jogo) passam a ir para um bucket
R2 privado: grava-se a chave (`comprovativo_chave`), nunca um URL público; um
admin lê-os por um URL assinado de vida curta.

- `comprovativo_chave` nova e nullable nas três tabelas.
- `pedidos_loja_jogo.comprovativo_url` passa a nullable (as linhas novas só
  têm a chave), com um CHECK a exigir pelo menos um dos dois -- a mesma
  garantia que o NOT NULL dava.
- Nenhum dado se move aqui: copiar os objectos antigos para o bucket
  privado precisa das credenciais do R2, que uma migração não deve ter. Isso
  é `scripts/migrar_comprovativos_privados.py`, corrido à mão; até lá, as
  linhas antigas continuam legíveis pelo `comprovativo_url` público.

Downgrade: recusa se já houver linhas só com a chave -- descer apagaria a
única referência a esses comprovativos.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b8e4f2a6c9d1"
down_revision: Union[str, None] = "a7d3e9c1f5b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABELAS = ("premium_requests", "doacoes", "pedidos_loja_jogo")


def upgrade() -> None:
    for tabela in TABELAS:
        op.add_column(tabela, sa.Column("comprovativo_chave", sa.Text(), nullable=True))
    op.alter_column("pedidos_loja_jogo", "comprovativo_url", existing_type=sa.Text(), nullable=True)
    op.create_check_constraint(
        "ck_pedidos_loja_jogo_comprovativo",
        "pedidos_loja_jogo",
        "comprovativo_url IS NOT NULL OR comprovativo_chave IS NOT NULL",
    )


def downgrade() -> None:
    ligacao = op.get_bind()
    for tabela in TABELAS:
        com_chave = ligacao.execute(
            sa.text(f"SELECT count(*) FROM {tabela} WHERE comprovativo_chave IS NOT NULL")
        ).scalar_one()
        if com_chave:
            raise RuntimeError(
                f"{tabela} tem {com_chave} comprovativo(s) no bucket privado -- "
                "descer esta migração apagaria a referência a eles."
            )
    op.drop_constraint("ck_pedidos_loja_jogo_comprovativo", "pedidos_loja_jogo", type_="check")
    op.alter_column("pedidos_loja_jogo", "comprovativo_url", existing_type=sa.Text(), nullable=False)
    for tabela in reversed(TABELAS):
        op.drop_column(tabela, "comprovativo_chave")
