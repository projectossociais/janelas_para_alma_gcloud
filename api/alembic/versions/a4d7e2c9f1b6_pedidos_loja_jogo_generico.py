"""pedidos da loja do jogo genéricos: diamantes ou moedas (tipo_item)

Revision ID: a4d7e2c9f1b6
Revises: c9e3a7f2d1b8
Create Date: 2026-09-24 00:00:00.000000

`pedidos_diamantes` passa a `pedidos_loja_jogo`, para a Loja de Moedas usar
o mesmo fluxo de pagamento (transferência + comprovativo + confirmação do
admin): nova coluna `tipo_item` ('diamantes' | 'moedas', CHECK) e
`diamantes` passa a `quantidade`. Renomeação no lugar -- os pedidos que já
existem ficam intactos, todos com `tipo_item = 'diamantes'` (o valor de
omissão). Restrições, índice, chave primária e chaves estrangeiras são
renomeados para o nome novo da tabela.

Downgrade: só é possível sem pedidos de moedas -- a tabela antiga não os
sabe representar e convertê-los em diamantes seria creditar o item errado.
Com pedidos de moedas, o downgrade recusa-se em vez de apagar dados
(CLAUDE.md secção 10).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a4d7e2c9f1b6"
down_revision: Union[str, None] = "c9e3a7f2d1b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_RENOMEACOES = (
    ("pedidos_diamantes_pkey", "pedidos_loja_jogo_pkey"),
    ("pedidos_diamantes_utilizador_id_fkey", "pedidos_loja_jogo_utilizador_id_fkey"),
    ("pedidos_diamantes_decidido_por_fkey", "pedidos_loja_jogo_decidido_por_fkey"),
    ("ck_pedidos_diamantes_estado", "ck_pedidos_loja_jogo_estado"),
    ("ck_pedidos_diamantes_preco_positivo", "ck_pedidos_loja_jogo_preco_positivo"),
)


def upgrade() -> None:
    op.rename_table("pedidos_diamantes", "pedidos_loja_jogo")
    for antigo, novo in _RENOMEACOES:
        op.execute(f"ALTER TABLE pedidos_loja_jogo RENAME CONSTRAINT {antigo} TO {novo}")
    op.execute("ALTER INDEX ix_pedidos_diamantes_utilizador_id RENAME TO ix_pedidos_loja_jogo_utilizador_id")

    op.drop_constraint("ck_pedidos_diamantes_diamantes_positivos", "pedidos_loja_jogo", type_="check")
    op.alter_column("pedidos_loja_jogo", "diamantes", new_column_name="quantidade")
    op.create_check_constraint("ck_pedidos_loja_jogo_quantidade_positiva", "pedidos_loja_jogo", "quantidade > 0")

    op.add_column(
        "pedidos_loja_jogo",
        sa.Column("tipo_item", sa.Text(), server_default="diamantes", nullable=False),
    )
    op.create_check_constraint(
        "ck_pedidos_loja_jogo_tipo_item", "pedidos_loja_jogo", "tipo_item IN ('diamantes', 'moedas')"
    )


def downgrade() -> None:
    moedas = op.get_bind().execute(
        sa.text("SELECT count(*) FROM pedidos_loja_jogo WHERE tipo_item = 'moedas'")
    ).scalar()
    if moedas:
        raise RuntimeError(
            f"há {moedas} pedido(s) de moedas em pedidos_loja_jogo -- a tabela antiga "
            "(pedidos_diamantes) não os representa. Exportar e decidir o que fazer com eles "
            "antes de descer esta migração; nada foi alterado."
        )

    op.drop_constraint("ck_pedidos_loja_jogo_tipo_item", "pedidos_loja_jogo", type_="check")
    op.drop_column("pedidos_loja_jogo", "tipo_item")

    op.drop_constraint("ck_pedidos_loja_jogo_quantidade_positiva", "pedidos_loja_jogo", type_="check")
    op.alter_column("pedidos_loja_jogo", "quantidade", new_column_name="diamantes")
    op.create_check_constraint("ck_pedidos_diamantes_diamantes_positivos", "pedidos_loja_jogo", "diamantes > 0")

    op.execute("ALTER INDEX ix_pedidos_loja_jogo_utilizador_id RENAME TO ix_pedidos_diamantes_utilizador_id")
    for antigo, novo in _RENOMEACOES:
        op.execute(f"ALTER TABLE pedidos_loja_jogo RENAME CONSTRAINT {novo} TO {antigo}")
    op.rename_table("pedidos_loja_jogo", "pedidos_diamantes")
