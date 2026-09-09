"""baseline — espelha o esquema de dados que existia no Supabase

Escrita à mão em vez de gerada por autogenerate: o Docker Desktop não estava
disponível nesta máquina no momento (daemon não estava a correr) para subir
um Postgres descartável e confirmar o autogenerate contra ele. Antes de esta
migração correr contra qualquer ambiente real, correr:

    docker compose up -d db
    alembic upgrade head
    alembic check   # ou: autogenerate contra a base já criada, deve dar "sem alterações"

Isto confirma que o que está escrito aqui bate certo com os modelos em
app/repositories/orm_models.py — ver CLAUDE.md, regra de nunca confiar às
cegas num ficheiro de esquema sem confirmar contra a base de dados real.

Revision ID: 202609090001
Revises:
Create Date: 2026-09-09

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "202609090001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

APP_ROLE_VALUES = (
    "admin",
    "comum",
    "voluntario",
    "oftalmologista",
    "profissional",
    "estrabico",
)


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    # Criado à parte, com checkfirst — e depois referenciado com
    # create_type=False na coluna. Sem isto, create_table() tenta criar o
    # tipo *outra vez* sozinho e a migração falha com "type already exists".
    app_role = postgresql.ENUM(*APP_ROLE_VALUES, name="app_role")
    app_role.create(op.get_bind(), checkfirst=True)
    papel_coluna_enum = postgresql.ENUM(*APP_ROLE_VALUES, name="app_role", create_type=False)

    op.create_table(
        "utilizadores",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("nome", sa.Text()),
        sa.Column("nome_completo", sa.Text()),
        sa.Column("avatar_url", sa.Text()),
        sa.Column("biografia", sa.Text()),
        sa.Column("data_nascimento", sa.Date()),
        sa.Column("genero", sa.Text()),
        sa.Column("provincia", sa.Text()),
        sa.Column("telefone", sa.Text()),
        sa.Column("papel", papel_coluna_enum, nullable=False, server_default="comum"),
        sa.Column("notificacoes_projetos", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("notificacoes_lembretes", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("notificacoes_comunidade", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("eliminar_agendado_para", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_utilizadores_email", "utilizadores", ["email"])

    op.create_table(
        "admin_permissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("utilizadores.id", ondelete="CASCADE")),
        sa.Column("is_super", sa.Boolean()),
        sa.Column("can_overview", sa.Boolean()),
        sa.Column("can_users", sa.Boolean()),
        sa.Column("can_content", sa.Boolean()),
        sa.Column("can_banners", sa.Boolean()),
        sa.Column("can_inbox", sa.Boolean()),
        sa.Column("can_notifications", sa.Boolean()),
        sa.Column("can_manage_admins", sa.Boolean()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "banners",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("titulo", sa.Text(), nullable=False),
        sa.Column("mensagem", sa.Text(), nullable=False),
        sa.Column("link", sa.Text()),
        sa.Column("ativo", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "contact_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("nome", sa.Text(), nullable=False),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("assunto", sa.Text()),
        sa.Column("mensagem", sa.Text(), nullable=False),
        sa.Column("lida", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "dados_bancarios",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("titular", sa.Text(), nullable=False),
        sa.Column("tipo", sa.Text(), nullable=False),
        sa.Column("numero", sa.Text(), nullable=False),
        sa.Column("iban", sa.Text()),
        sa.Column("ativo", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "doacoes",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("tipo", sa.Text(), nullable=False),
        sa.Column("valor", sa.Numeric()),
        sa.Column("materiais", postgresql.ARRAY(sa.Text())),
        sa.Column("detalhes", sa.Text()),
        sa.Column("recibo_id", sa.Text()),
        sa.Column("status", sa.Text(), server_default="pendente"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "doacoes_materiais",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("categorias", postgresql.ARRAY(sa.Text()), nullable=False),
        sa.Column("email", sa.Text()),
        sa.Column("detalhes", sa.Text()),
        sa.Column("contactado", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("criado_em", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "exames",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("utilizadores.id", ondelete="SET NULL")),
        sa.Column("tipo", sa.Text(), nullable=False),
        sa.Column("resultado", postgresql.JSONB()),
        sa.Column("observacoes", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("utilizadores.id", ondelete="CASCADE")),
        sa.Column("titulo", sa.Text(), nullable=False),
        sa.Column("mensagem", sa.Text(), nullable=False),
        sa.Column("lida", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "pontos_recolha",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("nome", sa.Text(), nullable=False),
        sa.Column("provincia", sa.Text(), nullable=False, server_default=""),
        sa.Column("endereco", sa.Text(), nullable=False),
        sa.Column("horario", sa.Text()),
        sa.Column("contacto", sa.Text()),
        sa.Column("ativo", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "premium_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("utilizadores.id", ondelete="SET NULL")),
        sa.Column("nome", sa.Text(), nullable=False),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("telefone", sa.Text()),
        sa.Column("plano", sa.Text()),
        sa.Column("status", sa.Text(), server_default="pendente"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "scanner_analyses",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("utilizadores.id", ondelete="CASCADE"), nullable=False),
        sa.Column("dados_clinicos", postgresql.JSONB(), nullable=False),
        sa.Column("diagnostico", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "screenings",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("utilizadores.id", ondelete="CASCADE"), nullable=False),
        sa.Column("estado", sa.Text(), nullable=False),
        sa.Column("rosto_detetado", sa.Boolean(), nullable=False),
        sa.Column("requer_avaliacao_humana", sa.Boolean(), nullable=False),
        sa.Column("consentimento_imagem", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("encaminhado", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("assimetria_horizontal", sa.Numeric()),
        sa.Column("assimetria_vertical", sa.Numeric()),
        sa.Column("qualidade_captura", sa.Numeric()),
        sa.Column("qualidade_fiavel", sa.Boolean()),
        sa.Column("qualidade_motivos", postgresql.ARRAY(sa.Text()), nullable=False, server_default="{}"),
        sa.Column("medicoes", postgresql.JSONB()),
        # Caminho apenas — nunca a imagem em si. Ver CLAUDE.md secção 4.
        sa.Column("imagem_path", sa.Text()),
        sa.Column("versao_analise", sa.Text()),
        sa.Column("criado_em", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "sessoes_exercicio",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("utilizadores.id", ondelete="CASCADE"), nullable=False),
        sa.Column("exercicio_id", sa.Text(), nullable=False),
        sa.Column("duracao_segundos", sa.Integer(), nullable=False),
        sa.Column("pontuacao", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("precisao_percentual", sa.Numeric(), nullable=False, server_default="0"),
        sa.Column("detalhes", postgresql.JSONB()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "site_content",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("chave", sa.Text(), nullable=False),
        sa.Column("valor", postgresql.JSONB(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("chave"),
    )

    op.create_table(
        "user_feedback",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("utilizadores.id", ondelete="SET NULL")),
        sa.Column("avaliacao", sa.Integer()),
        sa.Column("comentario", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("user_feedback")
    op.drop_table("site_content")
    op.drop_table("sessoes_exercicio")
    op.drop_table("screenings")
    op.drop_table("scanner_analyses")
    op.drop_table("premium_requests")
    op.drop_table("pontos_recolha")
    op.drop_table("notifications")
    op.drop_table("exames")
    op.drop_table("doacoes_materiais")
    op.drop_table("doacoes")
    op.drop_table("dados_bancarios")
    op.drop_table("contact_messages")
    op.drop_table("banners")
    op.drop_table("admin_permissions")
    op.drop_table("utilizadores")
    postgresql.ENUM(*APP_ROLE_VALUES, name="app_role").drop(op.get_bind(), checkfirst=True)
