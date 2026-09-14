"""Modelos SQLAlchemy — espelham o esquema de dados que já existia no
Supabase (extraído de supabase/migrations/*.sql e src/integrations/supabase/
types.ts do repositório antigo), com duas correcções deliberadas, decididas
ao arrancar do zero em vez de arrastadas como dívida:

1. `utilizadores` funde o que antes eram duas coisas (o `auth.users` do
   Supabase + a tabela `profiles`) — deixou de haver um Supabase Auth
   separado, por isso deixou de fazer sentido separar identidade de perfil.

2. `papel` é uma única coluna enum em `utilizadores`. O projecto antigo
   tinha `profiles.papel` (texto) e `user_roles` (enum) como duas fontes
   paralelas — ver CLAUDE.md (antigo) secção 6: "Não construir nada novo
   que agrave esta duplicação." Ao começar do zero, a correcção certa é não
   a reproduzir.

Todas as outras tabelas mantêm nome, colunas e tipos tal como estavam.
"""

import enum
import uuid
from datetime import date, datetime

from sqlalchemy import (
    ARRAY,
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class AppRole(str, enum.Enum):
    admin = "admin"
    comum = "comum"
    voluntario = "voluntario"
    oftalmologista = "oftalmologista"
    profissional = "profissional"
    estrabico = "estrabico"


def _uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )


class Utilizador(Base):
    """Identidade + perfil, num só sítio. Ver nota no topo do ficheiro."""

    __tablename__ = "utilizadores"

    id: Mapped[uuid.UUID] = _uuid_pk()
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)

    # O esquema antigo tinha `nome` e `nome_completo` como colunas paralelas
    # (dívida nunca resolvida). Ao começar do zero, só uma sobrevive.
    nome_completo: Mapped[str | None] = mapped_column(Text)
    avatar_url: Mapped[str | None] = mapped_column(Text)
    biografia: Mapped[str | None] = mapped_column(Text)
    data_nascimento: Mapped[date | None] = mapped_column(Date)
    genero: Mapped[str | None] = mapped_column(Text)
    provincia: Mapped[str | None] = mapped_column(Text)
    telefone: Mapped[str | None] = mapped_column(Text)

    papel: Mapped[AppRole] = mapped_column(
        Enum(AppRole, name="app_role"), nullable=False, server_default=AppRole.comum.value
    )

    # Acesso Premium — estado de subscrição, ortogonal ao `papel` (um
    # `estrabico` pode ter Premium). Activado por `PremiumService` ao aprovar
    # um pagamento; a expiração é sempre verificada na leitura, não há job a
    # desligar nada. Ver docs/BACKLOG.md, W-11.
    premium_ativo: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    premium_expira_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    notificacoes_projetos: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    notificacoes_lembretes: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    notificacoes_comunidade: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")

    # Ver antigo supabase/migrations/20260831120000_eliminacao_agendada_contas.sql
    eliminar_agendado_para: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class TokenRecuperacaoPassword(Base):
    """Token de uso único para o fluxo "esqueci-me da password" (ver
    services/recuperacao_password_service.py). Guarda-se o hash do token,
    nunca o valor em claro — o mesmo princípio de uma password: mesmo que a
    tabela vaze, ninguém consegue recuperar/reutilizar um link a partir dela.
    `usado_em` marca consumo (nunca se apaga a linha, fica o registo de que
    aquele token já serviu); `expira_em` é sempre verificado na leitura."""

    __tablename__ = "tokens_recuperacao_password"

    id: Mapped[uuid.UUID] = _uuid_pk()
    utilizador_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("utilizadores.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expira_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    usado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AdminPermission(Base):
    __tablename__ = "admin_permissions"

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("utilizadores.id", ondelete="CASCADE"))
    is_super: Mapped[bool | None] = mapped_column(Boolean)
    can_overview: Mapped[bool | None] = mapped_column(Boolean)
    can_users: Mapped[bool | None] = mapped_column(Boolean)
    can_content: Mapped[bool | None] = mapped_column(Boolean)
    can_banners: Mapped[bool | None] = mapped_column(Boolean)
    can_inbox: Mapped[bool | None] = mapped_column(Boolean)
    can_notifications: Mapped[bool | None] = mapped_column(Boolean)
    can_manage_admins: Mapped[bool | None] = mapped_column(Boolean)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Banner(Base):
    __tablename__ = "banners"

    id: Mapped[uuid.UUID] = _uuid_pk()
    titulo: Mapped[str] = mapped_column(Text, nullable=False)
    mensagem: Mapped[str] = mapped_column(Text, nullable=False)
    link: Mapped[str | None] = mapped_column(Text)
    ativo: Mapped[bool | None] = mapped_column(Boolean, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ContactMessage(Base):
    __tablename__ = "contact_messages"

    id: Mapped[uuid.UUID] = _uuid_pk()
    nome: Mapped[str] = mapped_column(Text, nullable=False)
    email: Mapped[str] = mapped_column(Text, nullable=False)
    assunto: Mapped[str | None] = mapped_column(Text)
    mensagem: Mapped[str] = mapped_column(Text, nullable=False)
    lida: Mapped[bool | None] = mapped_column(Boolean, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DadosBancarios(Base):
    __tablename__ = "dados_bancarios"

    id: Mapped[uuid.UUID] = _uuid_pk()
    titular: Mapped[str] = mapped_column(Text, nullable=False)
    tipo: Mapped[str] = mapped_column(Text, nullable=False)
    numero: Mapped[str] = mapped_column(Text, nullable=False)
    iban: Mapped[str | None] = mapped_column(Text)
    ativo: Mapped[bool | None] = mapped_column(Boolean, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Doacao(Base):
    __tablename__ = "doacoes"

    id: Mapped[uuid.UUID] = _uuid_pk()
    email: Mapped[str] = mapped_column(Text, nullable=False)
    tipo: Mapped[str] = mapped_column(Text, nullable=False)
    valor: Mapped[float | None] = mapped_column(Numeric)
    materiais: Mapped[list[str] | None] = mapped_column(ARRAY(Text))
    detalhes: Mapped[str | None] = mapped_column(Text)
    recibo_id: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str | None] = mapped_column(Text, server_default="pendente")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DoacaoMaterial(Base):
    __tablename__ = "doacoes_materiais"

    id: Mapped[uuid.UUID] = _uuid_pk()
    categorias: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False)
    email: Mapped[str | None] = mapped_column(Text)
    detalhes: Mapped[str | None] = mapped_column(Text)
    contactado: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Exame(Base):
    __tablename__ = "exames"

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("utilizadores.id", ondelete="SET NULL"))
    tipo: Mapped[str] = mapped_column(Text, nullable=False)
    resultado: Mapped[dict | None] = mapped_column(JSONB)
    observacoes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("utilizadores.id", ondelete="CASCADE"))
    titulo: Mapped[str] = mapped_column(Text, nullable=False)
    mensagem: Mapped[str] = mapped_column(Text, nullable=False)
    lida: Mapped[bool | None] = mapped_column(Boolean, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PontoRecolha(Base):
    __tablename__ = "pontos_recolha"

    id: Mapped[uuid.UUID] = _uuid_pk()
    nome: Mapped[str] = mapped_column(Text, nullable=False)
    provincia: Mapped[str] = mapped_column(Text, nullable=False, server_default="")
    endereco: Mapped[str] = mapped_column(Text, nullable=False)
    horario: Mapped[str | None] = mapped_column(Text)
    contacto: Mapped[str | None] = mapped_column(Text)
    ativo: Mapped[bool | None] = mapped_column(Boolean, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PremiumRequest(Base):
    __tablename__ = "premium_requests"

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("utilizadores.id", ondelete="SET NULL"))
    nome: Mapped[str] = mapped_column(Text, nullable=False)
    email: Mapped[str] = mapped_column(Text, nullable=False)
    telefone: Mapped[str | None] = mapped_column(Text)
    plano: Mapped[str | None] = mapped_column(Text)
    # "pendente" | "aprovado" | "revogado". Auditoria de quem decidiu e
    # quando — preenchido por `PremiumService`. Ver docs/BACKLOG.md, W-11.
    status: Mapped[str | None] = mapped_column(Text, server_default="pendente")
    aprovado_por: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("utilizadores.id", ondelete="SET NULL")
    )
    aprovado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ScannerAnalysis(Base):
    """Só medições/diagnóstico — nunca a imagem. Ver CLAUDE.md secção 4."""

    __tablename__ = "scanner_analyses"

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("utilizadores.id", ondelete="CASCADE"), nullable=False)
    dados_clinicos: Mapped[dict] = mapped_column(JSONB, nullable=False)
    diagnostico: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Screening(Base):
    __tablename__ = "screenings"

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("utilizadores.id", ondelete="CASCADE"), nullable=False)
    estado: Mapped[str] = mapped_column(Text, nullable=False)
    rosto_detetado: Mapped[bool] = mapped_column(Boolean, nullable=False)
    requer_avaliacao_humana: Mapped[bool] = mapped_column(Boolean, nullable=False)
    consentimento_imagem: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    encaminhado: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    assimetria_horizontal: Mapped[float | None] = mapped_column(Numeric)
    assimetria_vertical: Mapped[float | None] = mapped_column(Numeric)
    qualidade_captura: Mapped[float | None] = mapped_column(Numeric)
    qualidade_fiavel: Mapped[bool | None] = mapped_column(Boolean)
    qualidade_motivos: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, server_default="{}")
    medicoes: Mapped[dict | None] = mapped_column(JSONB)
    # Caminho apenas — nunca a imagem em si (descartada após extrair medições).
    imagem_path: Mapped[str | None] = mapped_column(Text)
    versao_analise: Mapped[str | None] = mapped_column(Text)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SessaoExercicio(Base):
    __tablename__ = "sessoes_exercicio"

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("utilizadores.id", ondelete="CASCADE"), nullable=False)
    exercicio_id: Mapped[str] = mapped_column(Text, nullable=False)
    duracao_segundos: Mapped[int] = mapped_column(nullable=False)
    pontuacao: Mapped[int] = mapped_column(nullable=False, server_default="0")
    precisao_percentual: Mapped[float] = mapped_column(Numeric, nullable=False, server_default="0")
    detalhes: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SiteContent(Base):
    __tablename__ = "site_content"

    id: Mapped[uuid.UUID] = _uuid_pk()
    chave: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    valor: Mapped[dict] = mapped_column(JSONB, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class UserFeedback(Base):
    __tablename__ = "user_feedback"

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("utilizadores.id", ondelete="SET NULL"))
    avaliacao: Mapped[int | None] = mapped_column()
    comentario: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
