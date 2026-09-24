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
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
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
    __table_args__ = (
        CheckConstraint(
            "(trial_iniciado_em IS NULL) = (trial_termina_em IS NULL)",
            name="ck_utilizadores_trial_consistente",
        ),
    )

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

    # Teste de 7 dias aos 4 exercícios base — uma única vez por conta.
    # `trial_iniciado_em IS NULL` = trial ainda disponível (é o estado de
    # todas as contas que já existiam antes desta coluna). Iniciado só pelo
    # próprio utilizador, por `AcessoExerciciosService.iniciar_trial`; tal
    # como o Premium, a validade é verificada na leitura, sem job nenhum.
    trial_iniciado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    trial_termina_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    notificacoes_projetos: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    notificacoes_lembretes: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    notificacoes_comunidade: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")

    # Voluntariado: estado ortogonal ao `papel`, mesmo desenho do Premium
    # (`premium_ativo` acima) — um profissional, um estrábico ou uma pessoa
    # comum podem todos ser voluntários sem deixar de ser o que já são.
    # Activado por `CandidaturaVoluntariadoService` ao aprovar uma
    # candidatura. Ver docs/BACKLOG.md.
    voluntario_ativo: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")

    # Ver antigo supabase/migrations/20260831120000_eliminacao_agendada_contas.sql
    eliminar_agendado_para: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # AUTH-02: conta nasce por confirmar; /auth/entrar recusa login enquanto
    # isto for false (bloqueio total, decisão do dono do projecto). Nunca há
    # sessão nenhuma antes de confirmar — o registo deixou de fazer login
    # automático. Ver services/confirmacao_email_service.py.
    email_confirmado: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")

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


class TokenConfirmacaoEmail(Base):
    """Token de uso único para confirmar a conta no registo (AUTH-02).
    Mesmo desenho do `TokenRecuperacaoPassword` (hash guardado, nunca o
    valor em claro; `usado_em` marca consumo) — validade mais longa (24h,
    ver serviço) porque confirmar não é tão urgente como recuperar acesso."""

    __tablename__ = "tokens_confirmacao_email"

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


class BannerHomepage(Base):
    """Banner visual da homepage (imagem + título/descrição/link) --
    entidade distinta de `Banner` (a faixa fina de aviso de texto, no topo
    de todas as páginas). Nasce sem `imagem_url`: a foto é sempre um
    upload em dois passos à parte (mesmo padrão de `Publicacao.capa_url`,
    nunca um campo de texto livre no create)."""

    __tablename__ = "banners_homepage"

    id: Mapped[uuid.UUID] = _uuid_pk()
    titulo: Mapped[str] = mapped_column(Text, nullable=False)
    descricao: Mapped[str | None] = mapped_column(Text)
    link: Mapped[str | None] = mapped_column(Text)
    imagem_url: Mapped[str | None] = mapped_column(Text)
    ativo: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
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
    # Comprovativo de transferência (doação financeira) -- upload directo ao
    # R2, mesmo padrão do avatar (CROSS-02). Nunca os bytes pela API.
    comprovativo_url: Mapped[str | None] = mapped_column(Text)
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
    # Comprovativo de pagamento -- upload directo ao R2, mesmo padrão do
    # avatar (CROSS-02). Um admin só aprova depois de confirmar isto.
    comprovativo_url: Mapped[str | None] = mapped_column(Text)
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
    # Sinal real para o matchmaker clínico (Fase 1, docs/BACKLOG.md Sprint 4) --
    # só "normal"/"requer_avaliacao", os únicos que o janelas-scanner-api de
    # facto calcula hoje. Não confundir com as 4 subcategorias de estrabismo
    # que `ScannerResultados.tsx` ainda mostra (Esotropia/Exotropia/...) --
    # essas vêm do antigo Math.random() (removido no PR #61) e nunca são
    # atribuídas pelo cálculo real; dívida à parte, não este campo.
    diagnostico: Mapped[str] = mapped_column(Text, nullable=False, server_default="normal")
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


class CandidaturaVoluntariado(Base):
    """Pedido para se tornar voluntário activo — mesmo desenho do
    `PremiumRequest` (pedido com estado + auditoria de quem decidiu e
    quando), aplicado ao voluntariado em vez do Premium."""

    __tablename__ = "candidaturas_voluntariado"

    id: Mapped[uuid.UUID] = _uuid_pk()
    utilizador_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("utilizadores.id", ondelete="CASCADE"), nullable=False, index=True
    )
    motivacao: Mapped[str] = mapped_column(Text, nullable=False)
    telefone: Mapped[str | None] = mapped_column(Text)
    # "pendente" | "aprovada" | "rejeitada"
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default="pendente")
    decidido_por: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("utilizadores.id", ondelete="SET NULL")
    )
    decidido_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AtividadeVoluntariado(Base):
    """Uma actividade publicada por um admin para os voluntários activos se
    inscreverem. `vagas` nulo significa sem limite."""

    __tablename__ = "atividades_voluntariado"

    id: Mapped[uuid.UUID] = _uuid_pk()
    titulo: Mapped[str] = mapped_column(Text, nullable=False)
    descricao: Mapped[str] = mapped_column(Text, nullable=False)
    local: Mapped[str] = mapped_column(Text, nullable=False)
    data_inicio: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    data_fim: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    vagas: Mapped[int | None] = mapped_column()
    # "publicada" | "cancelada" | "concluida"
    estado: Mapped[str] = mapped_column(Text, nullable=False, server_default="publicada")
    criado_por: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("utilizadores.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class InscricaoAtividade(Base):
    """Um voluntário inscrito numa actividade. `UNIQUE` impede duas
    inscrições da mesma pessoa na mesma actividade."""

    __tablename__ = "inscricoes_atividade"
    __table_args__ = (
        UniqueConstraint("atividade_id", "utilizador_id", name="uq_inscricoes_atividade_utilizador"),
    )

    id: Mapped[uuid.UUID] = _uuid_pk()
    atividade_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("atividades_voluntariado.id", ondelete="CASCADE"), nullable=False, index=True
    )
    utilizador_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("utilizadores.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # "inscrito" | "cancelado" | "compareceu" | "faltou"
    estado: Mapped[str] = mapped_column(Text, nullable=False, server_default="inscrito")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Publicacao(Base):
    """Uma publicação/actividade gerida pelo painel de administração --
    substitui o padrão antigo de escrever uma página React nova por cada
    campanha (ver docs/BACKLOG.md, ADMIN-03). `slug` é gerado pelo servidor
    a partir do título, nunca aceite do cliente -- é o que dá uma única
    página pública dinâmica (`/publicacoes/{slug}`) em vez de uma rota nova
    por publicação."""

    __tablename__ = "publicacoes"

    id: Mapped[uuid.UUID] = _uuid_pk()
    slug: Mapped[str] = mapped_column(Text, unique=True, nullable=False, index=True)
    titulo: Mapped[str] = mapped_column(Text, nullable=False)
    resumo: Mapped[str] = mapped_column(Text, nullable=False)
    corpo: Mapped[str] = mapped_column(Text, nullable=False)
    local: Mapped[str | None] = mapped_column(Text)
    data_evento: Mapped[date | None] = mapped_column(Date)
    capa_url: Mapped[str | None] = mapped_column(Text)
    # "rascunho" | "publicada"
    estado: Mapped[str] = mapped_column(Text, nullable=False, server_default="rascunho")
    criado_por: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("utilizadores.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class MidiaPublicacao(Base):
    """Uma foto da galeria de uma publicação. Upload directo ao R2, mesmo
    padrão do avatar (`upload_service.py`) -- os bytes nunca passam pela
    API. `ordem` decide a posição na galeria."""

    __tablename__ = "midias_publicacao"

    id: Mapped[uuid.UUID] = _uuid_pk()
    publicacao_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("publicacoes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    url: Mapped[str] = mapped_column(Text, nullable=False)
    ordem: Mapped[int] = mapped_column(nullable=False, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class UserFeedback(Base):
    __tablename__ = "user_feedback"

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("utilizadores.id", ondelete="SET NULL"))
    avaliacao: Mapped[int | None] = mapped_column()
    comentario: Mapped[str | None] = mapped_column(Text)


# As 6 categorias oficiais das perguntas do jogo (decisão do dono do
# projecto, 2026-09-24). `curiosidades_visuais` é a de omissão. Lista fechada
# também na base de dados (CHECK), para nenhuma categoria inventada entrar.
CATEGORIAS_PERGUNTA_JOGO = (
    "anatomia_ocular",
    "doencas_estrabismo",
    "prevencao_cuidados",
    "estilo_vida_visao",
    "ciencia_ocular",
    "curiosidades_visuais",
)
CATEGORIA_PERGUNTA_POR_OMISSAO = "curiosidades_visuais"


class RespostaOpcao(str, enum.Enum):
    A = "A"
    B = "B"
    C = "C"
    D = "D"


class PerguntaJogo(Base):
    """Pergunta do jogo "Você Sabia Que..." (estilo Quem Quer Ser
    Milionário). A resposta certa nunca sai daqui para o cliente antes da
    validação em `POST /jogo/validar` -- ver `schemas/jogo.py`
    (`PerguntaPublica` não tem `resposta_correta` nem `explicacao`)."""

    __tablename__ = "perguntas_jogo"
    __table_args__ = (
        CheckConstraint("nivel_dificuldade BETWEEN 1 AND 3", name="ck_perguntas_jogo_nivel_dificuldade"),
        CheckConstraint(
            "categoria IN ('anatomia_ocular', 'doencas_estrabismo', 'prevencao_cuidados', "
            "'estilo_vida_visao', 'ciencia_ocular', 'curiosidades_visuais')",
            name="ck_perguntas_jogo_categoria",
        ),
    )

    id: Mapped[uuid.UUID] = _uuid_pk()
    texto_pergunta: Mapped[str] = mapped_column(Text, nullable=False)
    opcao_a: Mapped[str] = mapped_column(Text, nullable=False)
    opcao_b: Mapped[str] = mapped_column(Text, nullable=False)
    opcao_c: Mapped[str] = mapped_column(Text, nullable=False)
    opcao_d: Mapped[str] = mapped_column(Text, nullable=False)
    resposta_correta: Mapped[RespostaOpcao] = mapped_column(
        Enum(RespostaOpcao, name="resposta_opcao"), nullable=False
    )
    nivel_dificuldade: Mapped[int] = mapped_column(nullable=False)
    explicacao: Mapped[str | None] = mapped_column(Text)
    categoria: Mapped[str] = mapped_column(Text, nullable=False, server_default=CATEGORIA_PERGUNTA_POR_OMISSAO)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PerfilJogador(Base):
    """Moedas, diamantes e estatísticas do jogo "Você Sabia Que...", um por
    utilizador -- separado de `Utilizador` porque é economia de jogo, não
    identidade/perfil geral da conta (mesma fronteira que já separa
    `PremiumRequest` ou `ScreeningResultado`). Nasce só quando o utilizador
    toca pela primeira vez em `/jogo/perfil` ou `/jogo/recompensas`, nunca
    no registo da conta -- ver `SQLAlchemyPerfilJogadorRepository.obter_ou_criar`."""

    __tablename__ = "perfis_jogador"

    id: Mapped[uuid.UUID] = _uuid_pk()
    utilizador_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("utilizadores.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    moedas: Mapped[int] = mapped_column(nullable=False, server_default="0")
    diamantes: Mapped[int] = mapped_column(nullable=False, server_default="0")
    partidas_jogadas: Mapped[int] = mapped_column(nullable=False, server_default="0")
    patamar_maximo_alcancado: Mapped[int] = mapped_column(nullable=False, server_default="0")
    # Maior número de acertos seguidos numa só partida (recorde de sempre).
    melhor_sequencia: Mapped[int] = mapped_column(nullable=False, server_default="0")
    # Limite diário de diamantes ganhos em sequências de acertos (dia UTC):
    # quanto já se ganhou em `diamantes_sequencia_dia`. Num dia novo, o
    # contador recomeça -- ver `JogoService.responder`.
    diamantes_sequencia_hoje: Mapped[int] = mapped_column(nullable=False, server_default="0")
    diamantes_sequencia_dia: Mapped[date | None] = mapped_column(Date)
    # Totais de sempre, para o nível do jogador e o Perfil: patamares
    # superados somados de todas as partidas, e moedas ganhas (o saldo
    # `moedas` pode vir a descer se um dia as moedas se gastarem).
    patamares_superados_total: Mapped[int] = mapped_column(nullable=False, server_default="0")
    moedas_ganhas_total: Mapped[int] = mapped_column(nullable=False, server_default="0")
    # O progresso da partida em curso vive em `PartidaJogo` desde 2026-09-24
    # (antes era a coluna `patamar_em_curso`, aqui).
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


ESTADOS_PEDIDO_LOJA = ("pendente", "aprovado", "rejeitado")
TIPOS_ITEM_LOJA = ("diamantes", "moedas")


class PedidoLojaJogo(Base):
    """Compra na loja do jogo paga em Kwanzas -- diamantes ou moedas
    (`tipo_item`). Mesmo fluxo do Premium (`PremiumRequest`): transferência
    bancária, comprovativo enviado ao R2, e só quando um admin confirma o
    pagamento é que a `quantidade` é creditada no saldo do `tipo_item`
    (`LojaJogoService.aprovar_pedido`, na mesma transacção que marca o
    pedido como aprovado -- nunca duas vezes).

    Quantidade e preço são copiados do catálogo (`PACOTES_DIAMANTES` /
    `PACOTES_MOEDAS`) no momento do pedido: o admin aprova o que o jogador
    viu e pagou, mesmo que o catálogo mude depois. Até 2026-09-24 chamava-se
    `pedidos_diamantes` e só vendia diamantes (migração `a4d7e2c9f1b6`)."""

    __tablename__ = "pedidos_loja_jogo"
    __table_args__ = (
        CheckConstraint(
            "estado IN ('pendente', 'aprovado', 'rejeitado')", name="ck_pedidos_loja_jogo_estado"
        ),
        CheckConstraint("tipo_item IN ('diamantes', 'moedas')", name="ck_pedidos_loja_jogo_tipo_item"),
        CheckConstraint("quantidade > 0", name="ck_pedidos_loja_jogo_quantidade_positiva"),
        CheckConstraint("preco_kz > 0", name="ck_pedidos_loja_jogo_preco_positivo"),
    )

    id: Mapped[uuid.UUID] = _uuid_pk()
    # SET NULL e não CASCADE: é um registo financeiro -- sobrevive à conta.
    utilizador_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("utilizadores.id", ondelete="SET NULL"), index=True
    )
    tipo_item: Mapped[str] = mapped_column(Text, nullable=False, server_default="diamantes")
    pacote_id: Mapped[str] = mapped_column(Text, nullable=False)
    quantidade: Mapped[int] = mapped_column(nullable=False)
    preco_kz: Mapped[int] = mapped_column(nullable=False)
    comprovativo_url: Mapped[str] = mapped_column(Text, nullable=False)
    estado: Mapped[str] = mapped_column(Text, nullable=False, server_default="pendente")
    decidido_por: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("utilizadores.id", ondelete="SET NULL"))
    decidido_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PartidaJogo(Base):
    """Uma partida do jogo "Inclusivamente", do primeiro patamar até terminar
    (vitória, derrota, desistência ou nova partida). Todo o estado que o
    jogador podia querer inventar vive aqui, controlado só pelo servidor
    (`JogoService`): a pergunta que o servidor entregou e à qual se está a
    responder, patamares superados, sequência de acertos, vidas extra e
    ajudas usadas.

    Estados: `em_curso` -> (erra ou esgota o tempo) -> `a_aguardar_decisao`
    -> (vida extra) -> `em_curso`, ou -> (encerra) -> `terminada`. No máximo
    uma partida não terminada por utilizador (índice único parcial).
    A recompensa é paga uma única vez, ao passar a `terminada`."""

    __tablename__ = "partidas_jogo"
    __table_args__ = (
        CheckConstraint(
            "estado IN ('em_curso', 'a_aguardar_decisao', 'terminada')", name="ck_partidas_jogo_estado"
        ),
        CheckConstraint("patamar_superado BETWEEN 0 AND 15", name="ck_partidas_jogo_patamar_superado"),
        Index(
            "uq_partidas_jogo_uma_ativa_por_utilizador",
            "utilizador_id",
            unique=True,
            postgresql_where=text("estado <> 'terminada'"),
        ),
    )

    id: Mapped[uuid.UUID] = _uuid_pk()
    utilizador_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("utilizadores.id", ondelete="CASCADE"), nullable=False, index=True
    )
    estado: Mapped[str] = mapped_column(Text, nullable=False, server_default="em_curso")
    patamar_superado: Mapped[int] = mapped_column(nullable=False, server_default="0")
    vidas_extra_usadas: Mapped[int] = mapped_column(nullable=False, server_default="0")
    cinquenta_cinquenta_usada: Mapped[bool] = mapped_column(nullable=False, server_default=text("false"))
    opiniao_publico_usada: Mapped[bool] = mapped_column(nullable=False, server_default=text("false"))
    trocar_pergunta_usada: Mapped[bool] = mapped_column(nullable=False, server_default=text("false"))
    # A pergunta que o servidor entregou a esta partida e ainda não foi
    # acertada. Só esta se pode validar (e só para esta se usam ajudas) --
    # sem isto, qualquer id de pergunta servia de oráculo para a resposta.
    # Mantém-se depois de uma falha, para a segunda tentativa (vida extra).
    pergunta_atual_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    # A opção falhada na pergunta actual (`None` se o tempo esgotou), para a
    # esconder na segunda tentativa.
    opcao_falhada: Mapped[str | None] = mapped_column(Text)
    # Acertos seguidos nesta partida; volta a 0 ao errar. Cada múltiplo de 3
    # dá diamantes (ver `recompensa_sequencia` em jogo_service.py).
    sequencia_acertos: Mapped[int] = mapped_column(nullable=False, server_default="0")
    diamantes_sequencia: Mapped[int] = mapped_column(nullable=False, server_default="0")
    moedas_ganhas: Mapped[int | None] = mapped_column()
    diamantes_ganhos: Mapped[int | None] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    terminada_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class EstatisticaCategoriaJogador(Base):
    """Respostas dadas e certas, por jogador e por categoria de pergunta --
    agregado (uma linha por par), actualizado na mesma transacção que regista
    a resposta (`PartidaJogoRepository.registar_acerto/registar_falha`), com
    um upsert atómico. Só conta respostas a perguntas do servidor, dadas numa
    partida com sessão; tempo esgotado conta como resposta errada."""

    __tablename__ = "estatisticas_categoria_jogador"
    __table_args__ = (
        UniqueConstraint("utilizador_id", "categoria", name="uq_estatisticas_categoria_jogador"),
        CheckConstraint(
            "categoria IN ('anatomia_ocular', 'doencas_estrabismo', 'prevencao_cuidados', "
            "'estilo_vida_visao', 'ciencia_ocular', 'curiosidades_visuais')",
            name="ck_estatisticas_categoria_jogador_categoria",
        ),
        CheckConstraint("acertos BETWEEN 0 AND respostas", name="ck_estatisticas_categoria_jogador_acertos"),
    )

    id: Mapped[uuid.UUID] = _uuid_pk()
    utilizador_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("utilizadores.id", ondelete="CASCADE"), nullable=False, index=True
    )
    categoria: Mapped[str] = mapped_column(Text, nullable=False)
    respostas: Mapped[int] = mapped_column(nullable=False, server_default="0")
    acertos: Mapped[int] = mapped_column(nullable=False, server_default="0")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class BloqueioVendedorJogo(Base):
    """Até quando um vendedor ambulante do Mercado (jogo "Inclusivamente")
    está bloqueado para um jogador, depois de lhe ter vendido uma ajuda --
    uma linha por par (utilizador, vendedor), reaproveitada a cada compra.
    `disponivel_em` em UTC; o bloqueio acaba sozinho quando passa, sem job
    nenhum a limpar (mesmo padrão de `premium_expira_em`). A duração (4h) e
    o catálogo de vendedores vivem em `services/mercado_jogo_service.py`;
    `vendedor_id` é o id estável desse catálogo, não uma FK."""

    __tablename__ = "bloqueios_vendedores_jogo"
    __table_args__ = (
        UniqueConstraint("utilizador_id", "vendedor_id", name="uq_bloqueios_vendedores_jogo_utilizador_vendedor"),
    )

    id: Mapped[uuid.UUID] = _uuid_pk()
    utilizador_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("utilizadores.id", ondelete="CASCADE"), nullable=False, index=True
    )
    vendedor_id: Mapped[str] = mapped_column(Text, nullable=False)
    disponivel_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ClinicaParceira(Base):
    """Clínica parceira -- identidade + perfil (especialidades, cidade,
    modalidade, preço indicativo; a disponibilidade semanal fica para a
    parte seguinte da Fase 1, ver docs/BACKLOG.md, Sprint 4). Nasce com uma
    linha semeada na migração baseline (Optioptika, o único parceiro
    assinado hoje) -- `agendamentos_clinicos` nunca fica preso a essa única
    clínica. Quem gere o perfil e a equipa é sempre um admin
    (`routers/clinicas.py`), nunca a própria clínica a auto-editar-se."""

    __tablename__ = "clinicas_parceiras"

    id: Mapped[uuid.UUID] = _uuid_pk()
    nome: Mapped[str] = mapped_column(Text, nullable=False)
    email_contacto: Mapped[str] = mapped_column(Text, nullable=False)
    telefone_contacto: Mapped[str] = mapped_column(Text, nullable=False)
    ativa: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    especialidades: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, server_default="{}")
    cidade: Mapped[str | None] = mapped_column(Text)
    modalidades_suportadas: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, server_default="{}")
    preco_indicativo: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class EquipaClinica(Base):
    """A única coisa que dá acesso ao portal de uma clínica (ver
    `core/dependencies.py`, `obter_clinica_do_utilizador`). `papel:
    "profissional"` é auto-registável sem verificação nenhuma
    (`PAPEIS_AUTO_REGISTAVEIS`), por isso a ligação conta→clínica nunca
    pode vir directamente desse papel -- só um admin a cria
    (`POST /admin/clinicas/{id}/equipa`). `utilizador_id` é UNIQUE: uma
    conta pertence, no máximo, a uma clínica nesta fase."""

    __tablename__ = "equipa_clinica"

    id: Mapped[uuid.UUID] = _uuid_pk()
    utilizador_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("utilizadores.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    clinica_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("clinicas_parceiras.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AgendamentoClinico(Base):
    """Pedido de consulta a uma clínica parceira. Não exige sessão -- mesmo
    padrão de `Doacao` (pedir ajuda médica não é uma relação contínua como o
    voluntariado, exigir conta seria fricção sem benefício real). Quando
    parte de uma sessão activa (ex.: a partir de um resultado de rastreio),
    liga-se a `utilizador_id`/`screening_id`; `nome`/`email`/`telefone`
    guardam-se sempre directamente, tal como `Doacao.email`, para o pedido
    nunca depender de um join para se conseguir contactar alguém."""

    __tablename__ = "agendamentos_clinicos"

    id: Mapped[uuid.UUID] = _uuid_pk()
    clinica_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("clinicas_parceiras.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    utilizador_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("utilizadores.id", ondelete="SET NULL"), index=True
    )
    screening_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("screenings.id", ondelete="SET NULL"))
    nome: Mapped[str] = mapped_column(Text, nullable=False)
    email: Mapped[str] = mapped_column(Text, nullable=False)
    telefone: Mapped[str] = mapped_column(Text, nullable=False)
    modalidade: Mapped[str] = mapped_column(Text, nullable=False)
    data_preferida: Mapped[date | None] = mapped_column(Date)
    periodo_preferido: Mapped[str | None] = mapped_column(Text)
    motivo: Mapped[str | None] = mapped_column(Text)
    estado: Mapped[str] = mapped_column(Text, nullable=False, server_default="pendente")
    decidido_por: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("utilizadores.id", ondelete="SET NULL"))
    decidido_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
