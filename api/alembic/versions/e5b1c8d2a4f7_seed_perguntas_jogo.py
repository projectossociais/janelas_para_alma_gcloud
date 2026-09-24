"""seed automático da reserva de perguntas do jogo (225 perguntas, 6 categorias)

Revision ID: e5b1c8d2a4f7
Revises: c3d8f1a6e9b2
Create Date: 2026-09-24 00:00:00.000000

Migração só de dados: semeia `perguntas_jogo` a partir de
`app/repositories/reserva_perguntas_jogo.py` (a mesma lista que o
`scripts/seed_maciço_perguntas.py` usava à mão), para o deploy automático
(`alembic upgrade head` no job `deploy-api`) deixar a produção semeada e
categorizada sem ninguém correr nada. Até aqui, uma base de dados nova ficava
com a tabela vazia e cada pergunta pedida com sessão caía na reserva local do
frontend, sem prémio.

Idempotente: insere só as perguntas que ainda não existem (pelo texto exacto)
e acerta a categoria das que já existem -- correr por cima de uma base de
dados já semeada à mão não duplica nada.

Downgrade: não apaga nada, de propósito. São dados de referência que podem
já existir antes desta migração (seed manual) e não se distinguem dos que ela
inseriu; apagá-los seria apagar dados em produção num rollback (CLAUDE.md
secção 10). Como o upgrade é idempotente, voltar a subir depois de descer é
seguro.
"""

from typing import Sequence, Union

from alembic import op

from app.repositories.reserva_perguntas_jogo import semear_perguntas

revision: str = "e5b1c8d2a4f7"
down_revision: Union[str, None] = "c3d8f1a6e9b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    resultado = semear_perguntas(op.get_bind())
    print(
        f"perguntas_jogo: {resultado.inseridas} inseridas, "
        f"{resultado.categorias_corrigidas} categorias corrigidas, {resultado.inalteradas} já em dia"
    )


def downgrade() -> None:
    # Sem nada a desfazer no esquema; os dados ficam (ver a docstring).
    pass
