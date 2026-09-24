"""partidas do jogo no servidor -- pergunta actual, vida extra, ajudas, sequências, categorias

Revision ID: c3d8f1a6e9b2
Revises: b9e4d2a7c1f5
Create Date: 2026-09-24 00:00:00.000000

Nova tabela `partidas_jogo`: uma linha por partida, com todo o estado que o
jogador podia querer inventar (a pergunta que o servidor lhe entregou,
patamares superados, sequência de acertos, vidas extra e ajudas usadas).
Índice único parcial: no máximo uma partida não terminada por utilizador.
Novas colunas em `perfis_jogador`: `melhor_sequencia` (recorde de acertos
seguidos) e `diamantes_sequencia_hoje`/`diamantes_sequencia_dia` (limite
diário, em UTC, de diamantes ganhos em sequências), `patamares_superados_total`
e `moedas_ganhas_total` (nível do jogador e Perfil).

Categorias (6, lista fechada com CHECK): nova coluna `perguntas_jogo.categoria`
(as que já existem ficam em `curiosidades_visuais` até o seed
`scripts/seed_maciço_perguntas.py` as classificar -- corrê-lo outra vez
actualiza a categoria das perguntas já semeadas) e nova tabela
`estatisticas_categoria_jogador` (respostas e acertos por jogador e categoria).

Substitui `perfis_jogador.patamar_em_curso`, que é removida: guardava só o
progresso transitório da partida em curso. Quem estiver a meio de uma
partida no momento do deploy perde esse progresso (não o saldo nem as
estatísticas) -- recomeça do patamar 1.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "c3d8f1a6e9b2"
down_revision: Union[str, None] = "b9e4d2a7c1f5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_CATEGORIAS = (
    "categoria IN ('anatomia_ocular', 'doencas_estrabismo', 'prevencao_cuidados', "
    "'estilo_vida_visao', 'ciencia_ocular', 'curiosidades_visuais')"
)


def upgrade() -> None:
    op.add_column(
        "perguntas_jogo",
        sa.Column("categoria", sa.Text(), server_default="curiosidades_visuais", nullable=False),
    )
    op.create_check_constraint("ck_perguntas_jogo_categoria", "perguntas_jogo", _CATEGORIAS)
    op.create_table(
        "estatisticas_categoria_jogador",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("utilizador_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("categoria", sa.Text(), nullable=False),
        sa.Column("respostas", sa.Integer(), server_default="0", nullable=False),
        sa.Column("acertos", sa.Integer(), server_default="0", nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(_CATEGORIAS, name="ck_estatisticas_categoria_jogador_categoria"),
        sa.CheckConstraint("acertos BETWEEN 0 AND respostas", name="ck_estatisticas_categoria_jogador_acertos"),
        sa.ForeignKeyConstraint(["utilizador_id"], ["utilizadores.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("utilizador_id", "categoria", name="uq_estatisticas_categoria_jogador"),
    )
    op.create_index(
        op.f("ix_estatisticas_categoria_jogador_utilizador_id"), "estatisticas_categoria_jogador", ["utilizador_id"]
    )
    op.create_table(
        "partidas_jogo",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("utilizador_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("estado", sa.Text(), server_default="em_curso", nullable=False),
        sa.Column("patamar_superado", sa.Integer(), server_default="0", nullable=False),
        sa.Column("vidas_extra_usadas", sa.Integer(), server_default="0", nullable=False),
        sa.Column("cinquenta_cinquenta_usada", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("opiniao_publico_usada", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("trocar_pergunta_usada", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("pergunta_atual_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("opcao_falhada", sa.Text(), nullable=True),
        sa.Column("sequencia_acertos", sa.Integer(), server_default="0", nullable=False),
        sa.Column("diamantes_sequencia", sa.Integer(), server_default="0", nullable=False),
        sa.Column("moedas_ganhas", sa.Integer(), nullable=True),
        sa.Column("diamantes_ganhos", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("terminada_em", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "estado IN ('em_curso', 'a_aguardar_decisao', 'terminada')", name="ck_partidas_jogo_estado"
        ),
        sa.CheckConstraint("patamar_superado BETWEEN 0 AND 15", name="ck_partidas_jogo_patamar_superado"),
        sa.ForeignKeyConstraint(["utilizador_id"], ["utilizadores.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_partidas_jogo_utilizador_id"), "partidas_jogo", ["utilizador_id"])
    op.create_index(
        "uq_partidas_jogo_uma_ativa_por_utilizador",
        "partidas_jogo",
        ["utilizador_id"],
        unique=True,
        postgresql_where=sa.text("estado <> 'terminada'"),
    )
    op.drop_column("perfis_jogador", "patamar_em_curso")
    op.add_column(
        "perfis_jogador",
        sa.Column("melhor_sequencia", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column(
        "perfis_jogador",
        sa.Column("diamantes_sequencia_hoje", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column("perfis_jogador", sa.Column("diamantes_sequencia_dia", sa.Date(), nullable=True))
    op.add_column(
        "perfis_jogador",
        sa.Column("patamares_superados_total", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column(
        "perfis_jogador",
        sa.Column("moedas_ganhas_total", sa.Integer(), server_default="0", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("perfis_jogador", "moedas_ganhas_total")
    op.drop_column("perfis_jogador", "patamares_superados_total")
    op.drop_index(
        op.f("ix_estatisticas_categoria_jogador_utilizador_id"), table_name="estatisticas_categoria_jogador"
    )
    op.drop_table("estatisticas_categoria_jogador")
    op.drop_constraint("ck_perguntas_jogo_categoria", "perguntas_jogo", type_="check")
    op.drop_column("perguntas_jogo", "categoria")
    op.drop_column("perfis_jogador", "diamantes_sequencia_dia")
    op.drop_column("perfis_jogador", "diamantes_sequencia_hoje")
    op.drop_column("perfis_jogador", "melhor_sequencia")
    op.add_column(
        "perfis_jogador",
        sa.Column("patamar_em_curso", sa.Integer(), server_default="0", nullable=False),
    )
    op.drop_index("uq_partidas_jogo_uma_ativa_por_utilizador", table_name="partidas_jogo")
    op.drop_index(op.f("ix_partidas_jogo_utilizador_id"), table_name="partidas_jogo")
    op.drop_table("partidas_jogo")
