"""comprovativos de pagamento validados automaticamente

Revision ID: 87f3ac3f0e85
Revises: a7d3e9c1f5b2
Create Date: 2026-10-14 20:43:42.356799

Validação instantânea do comprovativo do Premium (PDF ou captura de ecrã,
de qualquer banco angolano ou do Multicaixa Express): uma linha por tentativa, para auditoria e anti-replay. Tabela nova,
aditiva -- o acesso continua em `utilizadores.premium_ativo`/`premium_expira_em`.
Os índices únicos são parciais (`estado <> 'rejeitado'`): o mesmo ficheiro ou
a mesma operação bancária nunca contam duas vezes, mas uma tentativa rejeitada
não impede o reenvio corrigido.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "87f3ac3f0e85"
down_revision: Union[str, None] = "a7d3e9c1f5b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "comprovativos_pagamento",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("utilizador_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("referencia_transacao", sa.Text(), nullable=True),
        sa.Column("hash_sha256", sa.String(length=64), nullable=False),
    sa.Column("hash_perceptual", sa.String(length=64), nullable=True),
        sa.Column("montante_kz", sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column("origem", sa.Text(), nullable=True),
        sa.Column("destinatario_detectado", sa.Text(), nullable=True),
        sa.Column("data_transacao", sa.DateTime(timezone=True), nullable=True),
        sa.Column("metadados_ficheiro", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("texto_extraido", sa.Text(), nullable=True),
        sa.Column("chave_ficheiro", sa.Text(), nullable=False),
        sa.Column("estado", sa.Text(), nullable=False),
        sa.Column("motivo_codigo", sa.Text(), nullable=True),
        sa.Column("motivo", sa.Text(), nullable=True),
        sa.Column("premium_expira_em", sa.DateTime(timezone=True), nullable=True),
        sa.Column("decidido_por", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("decidido_em", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "criado_em", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.CheckConstraint(
            "estado IN ('aprovado', 'rejeitado', 'revisao_manual', 'revogado')",
            name="ck_comprovativos_pagamento_estado",
        ),
        sa.CheckConstraint(
            "origem IS NULL OR origem IN ('bai_directo', 'multicaixa_express', 'bfa', 'bic', 'atlantico', 'banco_sol', 'standard_bank', 'keve', 'access_bank', 'bni', 'caixa_angola', 'outro')",
            name="ck_comprovativos_pagamento_origem",
        ),
        sa.ForeignKeyConstraint(["decidido_por"], ["utilizadores.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["utilizador_id"], ["utilizadores.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_comprovativos_pagamento_utilizador_id"),
        "comprovativos_pagamento",
        ["utilizador_id"],
        unique=False,
    )
    op.create_index(
        "uq_comprovativos_pagamento_hash_activo",
        "comprovativos_pagamento",
        ["hash_sha256"],
        unique=True,
        postgresql_where=sa.text("estado <> 'rejeitado'"),
    )
    op.create_index(
        "uq_comprovativos_pagamento_referencia_activa",
        "comprovativos_pagamento",
        ["referencia_transacao"],
        unique=True,
        postgresql_where=sa.text("estado <> 'rejeitado' AND referencia_transacao IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_comprovativos_pagamento_referencia_activa",
        table_name="comprovativos_pagamento",
        postgresql_where=sa.text("estado <> 'rejeitado' AND referencia_transacao IS NOT NULL"),
    )
    op.drop_index(
        "uq_comprovativos_pagamento_hash_activo",
        table_name="comprovativos_pagamento",
        postgresql_where=sa.text("estado <> 'rejeitado'"),
    )
    op.drop_index(
        op.f("ix_comprovativos_pagamento_utilizador_id"), table_name="comprovativos_pagamento"
    )
    op.drop_table("comprovativos_pagamento")
