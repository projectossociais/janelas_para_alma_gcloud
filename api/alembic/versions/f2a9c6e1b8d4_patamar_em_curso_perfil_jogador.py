"""patamar_em_curso no perfil do jogador -- progresso rastreado no servidor

Revision ID: f2a9c6e1b8d4
Revises: e7c1a4d9f3b6
Create Date: 2026-09-23 00:00:00.000000

Fecha um buraco real: `POST /jogo/recompensas` confiava no `patamar_alcancado`
que o próprio cliente dizia ter alcançado, sem nenhuma verificação -- um
pedido forjado dava o prémio máximo sem responder a nada. Esta coluna passa a
guardar, no servidor, o progresso da partida em curso (incrementado só por
`POST /jogo/validar` quando a resposta está certa e a pergunta é do nível
esperado); `/jogo/recompensas` lê daqui, nunca do corpo do pedido.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f2a9c6e1b8d4"
down_revision: Union[str, None] = "e7c1a4d9f3b6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "perfis_jogador",
        sa.Column("patamar_em_curso", sa.Integer(), server_default="0", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("perfis_jogador", "patamar_em_curso")
