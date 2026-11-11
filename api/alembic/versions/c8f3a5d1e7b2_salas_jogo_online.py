"""salas do Multijogador Online do jogo, com chat entre adultos

Revision ID: c8f3a5d1e7b2
Revises: b4e7c2d9a1f6
Create Date: 2026-11-10 00:00:00.000000

Quatro tabelas novas:
- `salas_jogo`: uma sala por código, com o estado da partida decidido pelo
  servidor (pergunta em curso, prazo de resposta, vencedores).
- `jogadores_sala_jogo`: os (dois) jogadores de cada sala, pontos, resposta da
  ronda, último sinal de vida e o prémio creditado.
- `mensagens_sala_jogo`: chat da sala, só entre dois adultos e já filtrado.
- `denuncias_chat_jogo`: denúncias do chat.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "c8f3a5d1e7b2"
down_revision: Union[str, None] = "b4e7c2d9a1f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_UUID = postgresql.UUID(as_uuid=True)


def _id() -> sa.Column:
    return sa.Column("id", _UUID, server_default=sa.text("gen_random_uuid()"), nullable=False)


def _agora(nome: str) -> sa.Column:
    return sa.Column(nome, sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False)


def upgrade() -> None:
    op.create_table(
        "salas_jogo",
        _id(),
        sa.Column("codigo", sa.String(length=8), nullable=False),
        sa.Column("anfitriao_id", _UUID, nullable=False),
        sa.Column("estado", sa.Text(), server_default="a_aguardar", nullable=False),
        sa.Column("fase", sa.Text(), nullable=True),
        sa.Column("ronda", sa.Integer(), server_default="0", nullable=False),
        sa.Column("desempate", sa.Integer(), server_default="0", nullable=False),
        sa.Column("pergunta_atual_id", _UUID, nullable=True),
        sa.Column("perguntas_entregues", postgresql.ARRAY(_UUID), server_default="{}", nullable=False),
        sa.Column("prazo_resposta", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revelacao_ate", sa.DateTime(timezone=True), nullable=True),
        sa.Column("chat_bloqueado", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("vencedores", postgresql.ARRAY(_UUID), server_default="{}", nullable=False),
        sa.Column("motivo_fim", sa.Text(), nullable=True),
        _agora("created_at"),
        _agora("updated_at"),
        sa.Column("terminada_em", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "estado IN ('a_aguardar', 'em_curso', 'terminada', 'abandonada')", name="ck_salas_jogo_estado"
        ),
        sa.CheckConstraint("fase IS NULL OR fase IN ('pergunta', 'revelacao')", name="ck_salas_jogo_fase"),
        sa.ForeignKeyConstraint(["anfitriao_id"], ["utilizadores.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_salas_jogo_codigo", "salas_jogo", ["codigo"], unique=True)
    op.create_index("ix_salas_jogo_anfitriao_id", "salas_jogo", ["anfitriao_id"], unique=False)

    op.create_table(
        "jogadores_sala_jogo",
        _id(),
        sa.Column("sala_id", _UUID, nullable=False),
        sa.Column("utilizador_id", _UUID, nullable=False),
        sa.Column("ordem", sa.Integer(), nullable=False),
        sa.Column("nome", sa.Text(), nullable=False),
        sa.Column("adulto", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("pontos", sa.Integer(), server_default="0", nullable=False),
        sa.Column("acertos", sa.Integer(), server_default="0", nullable=False),
        sa.Column("resposta_ronda", sa.Text(), nullable=True),
        sa.Column("respondeu_em", sa.DateTime(timezone=True), nullable=True),
        sa.Column("certa_ronda", sa.Boolean(), nullable=True),
        sa.Column("pontos_ronda", sa.Integer(), server_default="0", nullable=False),
        _agora("visto_em"),
        sa.Column("moedas_sem_limite", sa.Integer(), nullable=True),
        sa.Column("moedas_ganhas", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["sala_id"], ["salas_jogo.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["utilizador_id"], ["utilizadores.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("sala_id", "utilizador_id", name="uq_jogadores_sala_jogo_sala_utilizador"),
    )
    op.create_index("ix_jogadores_sala_jogo_sala_id", "jogadores_sala_jogo", ["sala_id"], unique=False)
    op.create_index("ix_jogadores_sala_jogo_utilizador_id", "jogadores_sala_jogo", ["utilizador_id"], unique=False)

    op.create_table(
        "mensagens_sala_jogo",
        _id(),
        sa.Column("sala_id", _UUID, nullable=False),
        sa.Column("utilizador_id", _UUID, nullable=False),
        sa.Column("texto", sa.Text(), nullable=False),
        _agora("created_at"),
        sa.ForeignKeyConstraint(["sala_id"], ["salas_jogo.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["utilizador_id"], ["utilizadores.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_mensagens_sala_jogo_sala_id", "mensagens_sala_jogo", ["sala_id"], unique=False)
    op.create_index("ix_mensagens_sala_jogo_utilizador_id", "mensagens_sala_jogo", ["utilizador_id"], unique=False)

    op.create_table(
        "denuncias_chat_jogo",
        _id(),
        sa.Column("sala_id", _UUID, nullable=False),
        sa.Column("denunciante_id", _UUID, nullable=False),
        _agora("created_at"),
        sa.ForeignKeyConstraint(["sala_id"], ["salas_jogo.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["denunciante_id"], ["utilizadores.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_denuncias_chat_jogo_sala_id", "denuncias_chat_jogo", ["sala_id"], unique=False)
    op.create_index("ix_denuncias_chat_jogo_denunciante_id", "denuncias_chat_jogo", ["denunciante_id"], unique=False)


def downgrade() -> None:
    op.drop_table("denuncias_chat_jogo")
    op.drop_table("mensagens_sala_jogo")
    op.drop_table("jogadores_sala_jogo")
    op.drop_table("salas_jogo")
