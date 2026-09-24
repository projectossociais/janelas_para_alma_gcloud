"""junta os dois heads: perfil de clínica (#93) e pedidos de diamantes (#94)

Revision ID: c9e3a7f2d1b8
Revises: d5b1f8a3c6e2, f8c2d6a1b3e9
Create Date: 2026-09-24 00:00:00.000000

Migração de junção, sem alterações de esquema. #93 (`d5b1f8a3c6e2`, perfil de
clínica) e #94 (`f8c2d6a1b3e9`, pedidos de diamantes) partiram ambos de
`e5b1c8d2a4f7` e foram fundidos em separado -- `main` ficou com dois heads,
`alembic upgrade head` recusou ("Multiple head revisions") e o CI de `main`
falhou a seguir ao merge do #94, com o `deploy-api` saltado.

Junção em vez de editar o `down_revision` de uma delas: nenhuma migração já
existente muda, e funciona tanto numa base de dados que já tenha só uma das
duas (produção tem a `d5b1f8a3c6e2`) como numa que tenha as duas.
"""

from typing import Sequence, Union

revision: str = "c9e3a7f2d1b8"
down_revision: Union[str, Sequence[str], None] = ("d5b1f8a3c6e2", "f8c2d6a1b3e9")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
