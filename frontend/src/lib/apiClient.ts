import i18n from "@/i18n";
/**
 * Cliente fino para a API própria (FastAPI). Nunca guarda tokens — a sessão
 * viaja em cookies `httpOnly` que o browser gere sozinho; por isso todo o
 * pedido leva `credentials: "include"`, e não há "access token" nenhum para
 * este módulo tocar.
 *
 * Ver CLAUDE.md secção 0 — autenticação, perfil, banners, doações, feedback,
 * sessões de exercício, scanner (`screenings`), dashboard, formulário de
 * contacto, Premium (W-11), candidaturas de voluntariado e gestão de admins
 * já estão migrados. Ver CLAUDE.md secção 11 (dívida conhecida) para o que
 * ainda falta — inclui um bug real, não só dívida: os formulários públicos
 * de candidatura a voluntário (`ContactSection.tsx`, `VolunteerSection.tsx`)
 * ainda não chamam `voluntariadoApi.candidatar` definido aqui, chamam uma
 * Edge Function do Supabase que só envia um email (docs/BACKLOG.md W-16).
 */

// Mesma origem por omissão: `/api/*` é servido pelo rewrite de `vercel.json`
// em produção e pelo proxy do Vite em `npm run dev` (ver vite.config.ts),
// ambos a reencaminhar para a API. É o que torna o cookie `httpOnly` de
// sessão utilizável sem CORS. `VITE_API_URL` só é preciso para apontar o dev
// a uma API remota.
const API_URL = import.meta.env.VITE_API_URL ?? "/api";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * Extrai uma mensagem apresentável de um erro vindo daqui — por duck-typing
 * (propriedade `status`), não `instanceof ApiError`. Este módulo é mockado
 * em quase todos os testes de página/contexto; uma classe importada de um
 * módulo mockado não passa fiavelmente num `instanceof` do lado de quem a
 * usa. Ver CLAUDE.md, secção "Testes (Vitest)".
 */
export function mensagemDeErroApi(err: unknown, fallback: string): string {
  const status = (err as { status?: unknown } | null)?.status;
  const message = (err as { message?: unknown } | null)?.message;
  return typeof status === "number" && typeof message === "string" ? message : fallback;
}

interface CorpoDeErro {
  detail?: string | { msg?: string }[];
}

function mensagemDeErro(corpo: unknown): string | null {
  if (!corpo || typeof corpo !== "object") return null;
  const detail = (corpo as CorpoDeErro).detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && typeof detail[0]?.msg === "string") return detail[0].msg;
  return null;
}

/** Tenta renovar o access token pelo refresh token (cookie httpOnly, 30
 *  dias) -- `fetch` cru, não `pedido()`, para nunca poder entrar em
 *  recursão. Devolve `false` em qualquer falha (refresh também expirado,
 *  rede em baixo, etc.) -- quem chamou fica com o 401 original. */
async function tentarRenovarToken(): Promise<boolean> {
  try {
    const resposta = await fetch(`${API_URL}/auth/atualizar-token`, {
      method: "POST",
      credentials: "include",
    });
    return resposta.ok;
  } catch {
    return false;
  }
}

async function pedido<T>(caminho: string, opcoes: RequestInit = {}, jaTentouRenovar = false): Promise<T> {
  const resposta = await fetch(`${API_URL}${caminho}`, {
    ...opcoes,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...opcoes.headers },
  });

  // O access token dura só 15 minutos (ver CLAUDE.md §3b) -- sem isto,
  // qualquer página onde o utilizador fique parado mais tempo sem nenhum
  // pedido de fundo perdia a sessão em silêncio, e só se notava (com um 401
  // inesperado) no próximo clique. O refresh token (30 dias) já existia no
  // backend; só faltava o browser alguma vez o usar. Uma única tentativa
  // (`jaTentouRenovar` corta a recursão) — se o refresh também falhar
  // (expirado, revogado), o 401 original segue tal como antes.
  if (resposta.status === 401 && !jaTentouRenovar) {
    const renovou = await tentarRenovarToken();
    if (renovou) {
      return pedido<T>(caminho, opcoes, true);
    }
  }

  if (!resposta.ok) {
    let mensagem = i18n.t("apiClient.ocorreuUmErroTente");
    try {
      mensagem = mensagemDeErro(await resposta.json()) ?? mensagem;
    } catch {
      // Corpo vazio ou não-JSON (ex.: 500 sem handler de excepção devolve
      // texto simples, não JSON) — a mensagem ao utilizador fica genérica de
      // propósito, mas a consola leva o corpo tal como veio: é o único sítio
      // onde um erro real (tabela em falta, migração por correr, etc.) fica
      // visível sem ter de instrumentar o backend.
    }
    console.error(`[apiClient] ${caminho} → ${resposta.status}: ${mensagem}`);
    throw new ApiError(resposta.status, mensagem);
  }

  if (resposta.status === 204) return undefined as T;
  return (await resposta.json()) as T;
}

export interface UtilizadorPublico {
  id: string;
  email: string;
  papel: string;
  nome_completo: string | null;
  provincia: string | null;
  genero: string | null;
  criado_em: string;
  /** AUTH-02 — false logo após o registo; /auth/entrar recusa login
   *  enquanto isto for false (bloqueio total). */
  email_confirmado: boolean;
  eliminacao_cancelada: boolean;
}

export interface RegistarInput {
  email: string;
  password: string;
  nome_completo?: string;
  provincia?: string;
  genero?: string;
  papel?: string;
}

export const authApi = {
  registar: (dados: RegistarInput) =>
    pedido<UtilizadorPublico>("/auth/registar", { method: "POST", body: JSON.stringify(dados) }),

  entrar: (email: string, password: string) =>
    pedido<UtilizadorPublico>("/auth/entrar", { method: "POST", body: JSON.stringify({ email, password }) }),

  /** `idToken` vem do Google Identity Services -- a API verifica a
   *  assinatura antes de confiar em qualquer campo dele. */
  entrarComGoogle: (idToken: string) =>
    pedido<UtilizadorPublico>("/auth/google", { method: "POST", body: JSON.stringify({ id_token: idToken }) }),

  eu: () => pedido<UtilizadorPublico>("/auth/eu"),

  sair: () => pedido<void>("/auth/sair", { method: "POST" }),

  atualizarToken: () => pedido<void>("/auth/atualizar-token", { method: "POST" }),

  /** Resposta idêntica exista ou não conta com este email — a API nunca
   *  revela isso (ver api/app/services/recuperacao_password_service.py). */
  recuperarPassword: (email: string) =>
    pedido<{ mensagem: string }>("/auth/recuperar-password", { method: "POST", body: JSON.stringify({ email }) }),

  /** `token` vem do link recebido por email. Um token inválido, expirado
   *  ou já usado devolve 400 — nunca sucesso fabricado. */
  redefinirPassword: (token: string, passwordNova: string) =>
    pedido<void>("/auth/redefinir-password", {
      method: "POST",
      body: JSON.stringify({ token, password_nova: passwordNova }),
    }),

  /** AUTH-02. `token` vem do link de confirmação recebido por email logo
   *  após o registo. Um token inválido, expirado ou já usado devolve 400. */
  confirmarEmail: (token: string) =>
    pedido<void>("/auth/confirmar-email", { method: "POST", body: JSON.stringify({ token }) }),

  /** Pedido explícito de um novo link -- resposta idêntica exista ou não a
   *  conta, esteja ou não já confirmada (mesmo princípio de recuperarPassword). */
  reenviarConfirmacao: (email: string) =>
    pedido<{ mensagem: string }>("/auth/reenviar-confirmacao", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
};

export interface PerfilPublico {
  id: string;
  email: string;
  papel: string;
  nome_completo: string | null;
  biografia: string | null;
  telefone: string | null;
  data_nascimento: string | null;
  genero: string | null;
  provincia: string | null;
  avatar_url: string | null;
  /** Já vem com a validade verificada pela API — não é preciso comparar datas. */
  premium_ativo: boolean;
  premium_expira_em: string | null;
  notificacoes_projetos: boolean;
  notificacoes_lembretes: boolean;
  notificacoes_comunidade: boolean;
  criado_em: string;
}

export interface PerfilAtualizarInput {
  nome_completo?: string;
  biografia?: string | null;
  telefone?: string | null;
  data_nascimento?: string | null;
  genero?: string | null;
  provincia?: string | null;
  notificacoes_projetos?: boolean;
  notificacoes_lembretes?: boolean;
  notificacoes_comunidade?: boolean;
}

export const perfilApi = {
  obter: () => pedido<PerfilPublico>("/perfil"),

  atualizar: (dados: PerfilAtualizarInput) =>
    pedido<PerfilPublico>("/perfil", { method: "PATCH", body: JSON.stringify(dados) }),
};

export interface EliminacaoAgendada {
  agendada_para: string;
}

export const contaApi = {
  mudarPassword: (passwordAtual: string, passwordNova: string) =>
    pedido<void>("/conta/mudar-password", {
      method: "POST",
      body: JSON.stringify({ password_atual: passwordAtual, password_nova: passwordNova }),
    }),

  /** Nunca elimina na hora — agenda para daqui a 30 dias e termina a sessão. */
  eliminar: () => pedido<EliminacaoAgendada>("/conta/eliminar", { method: "POST" }),
};

export interface BannerPublico {
  id: string;
  titulo: string;
  mensagem: string;
  link: string | null;
  created_at: string;
}

/** O banner como o painel de administração o vê — inclui `ativo`. */
export interface BannerAdmin extends BannerPublico {
  ativo: boolean;
}

export interface BannerCriarInput {
  titulo: string;
  mensagem: string;
  link?: string | null;
  ativo?: boolean;
}

export interface BannerAtualizarInput {
  titulo?: string;
  mensagem?: string;
  link?: string | null;
  ativo?: boolean;
}

export const bannersApi = {
  obterAtivo: () => pedido<BannerPublico | null>("/banners/ativo"),

  /** Gestão — exige sessão com papel `admin` (a API devolve 403 caso contrário). */
  listar: () => pedido<BannerAdmin[]>("/banners"),

  criar: (dados: BannerCriarInput) =>
    pedido<BannerAdmin>("/banners", { method: "POST", body: JSON.stringify(dados) }),

  atualizar: (id: string, dados: BannerAtualizarInput) =>
    pedido<BannerAdmin>(`/banners/${id}`, { method: "PATCH", body: JSON.stringify(dados) }),

  remover: (id: string) => pedido<void>(`/banners/${id}`, { method: "DELETE" }),
};

export interface AvatarUploadPreparado {
  url_de_upload: string;
  chave: string;
  url_publico: string;
}

export const TIPOS_DE_AVATAR_ACEITES = ["image/png", "image/jpeg", "image/webp"] as const;

export const uploadsApi = {
  /** Passo 1: a API assina um URL de PUT para o browser enviar o ficheiro
   *  directamente ao R2. Os bytes nunca passam pela nossa API. */
  prepararAvatar: (contentType: string) =>
    pedido<AvatarUploadPreparado>("/uploads/avatar", {
      method: "POST",
      body: JSON.stringify({ content_type: contentType }),
    }),

  /** Passo 2: envio directo ao storage — fora do `apiClient` de propósito
   *  (outra origem, sem cookies, corpo binário e não JSON). */
  enviarParaStorage: async (urlDeUpload: string, ficheiro: File): Promise<void> => {
    const resposta = await fetch(urlDeUpload, {
      method: "PUT",
      body: ficheiro,
      headers: { "Content-Type": ficheiro.type },
    });
    if (!resposta.ok) {
      throw new ApiError(resposta.status, "Não foi possível enviar a imagem para o storage.");
    }
  },

  /** Passo 3: confirma a chave (a API valida que é do próprio utilizador)
   *  e grava-a em `avatar_url`. */
  confirmarAvatar: (chave: string) =>
    pedido<{ avatar_url: string }>("/uploads/avatar/confirmar", {
      method: "POST",
      body: JSON.stringify({ chave }),
    }),
};

// --- Banner-imagem da homepage -----------------------------------------------
// Entidade distinta de `banners` (a faixa fina de texto no topo do site) --
// uma secção visual só na homepage, com foto. Nasce sem imagem; a foto é
// sempre um upload em dois passos à parte, mesmo padrão de `publicacoesApi`
// (capa), ver mais abaixo.

export interface BannerHomepagePublico {
  id: string;
  titulo: string;
  descricao: string | null;
  link: string | null;
  imagem_url: string | null;
}

export interface BannerHomepageAdmin extends BannerHomepagePublico {
  ativo: boolean;
  created_at: string;
}

export interface BannerHomepageCriarInput {
  titulo: string;
  descricao?: string | null;
  link?: string | null;
  ativo?: boolean;
}

export interface BannerHomepageAtualizarInput {
  titulo?: string;
  descricao?: string | null;
  link?: string | null;
  ativo?: boolean;
}

export interface ImagemUploadPreparado {
  url_de_upload: string;
  chave: string;
  url_publico: string;
}

export const bannerHomepageApi = {
  obterAtivo: () => pedido<BannerHomepagePublico | null>("/banners-homepage/ativo"),

  /** Gestão — exige sessão com papel `admin` (a API devolve 403 caso contrário). */
  listar: () => pedido<BannerHomepageAdmin[]>("/banners-homepage"),

  criar: (dados: BannerHomepageCriarInput) =>
    pedido<BannerHomepageAdmin>("/banners-homepage", { method: "POST", body: JSON.stringify(dados) }),

  atualizar: (id: string, dados: BannerHomepageAtualizarInput) =>
    pedido<BannerHomepageAdmin>(`/banners-homepage/${id}`, { method: "PATCH", body: JSON.stringify(dados) }),

  remover: (id: string) => pedido<void>(`/banners-homepage/${id}`, { method: "DELETE" }),

  // Foto — mesmo fluxo de 3 passos do avatar/publicações --------------------
  prepararImagem: (bannerId: string, contentType: string) =>
    pedido<ImagemUploadPreparado>(`/banners-homepage/${bannerId}/imagem/preparar`, {
      method: "POST",
      body: JSON.stringify({ content_type: contentType }),
    }),

  confirmarImagem: (bannerId: string, chave: string) =>
    pedido<{ imagem_url: string }>(`/banners-homepage/${bannerId}/imagem/confirmar`, {
      method: "POST",
      body: JSON.stringify({ chave }),
    }),

  /** Envio directo ao storage — fora do `apiClient` de propósito (outra
   *  origem, sem cookies, corpo binário). Reutiliza a mesma lógica de
   *  `uploadsApi.enviarParaStorage`. */
  enviarParaStorage: uploadsApi.enviarParaStorage,
};

// --- Upload de comprovativos (CROSS-02) --------------------------------
// Doação financeira e pedido Premium — substitui o envio do ficheiro por
// uma Edge Function do Supabase. Público de propósito: doar ou pedir
// Premium não exige sessão. Mesmo fluxo de 3 passos do avatar; o passo 3
// aqui não é "confirmar" (nada fica gravado ainda) — a chave devolvida no
// passo 1 vai directamente no pedido que cria a doação/o pedido Premium.

export interface ComprovativoUploadPreparado {
  url_de_upload: string;
  chave: string;
  url_publico: string;
}

export const TIPOS_DE_COMPROVATIVO_ACEITES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
] as const;

export const comprovativosApi = {
  preparar: (contentType: string) =>
    pedido<ComprovativoUploadPreparado>("/uploads/comprovativo", {
      method: "POST",
      body: JSON.stringify({ content_type: contentType }),
    }),

  /** Mesmo passo 2 do avatar — reutilizado tal e qual. */
  enviarParaStorage: uploadsApi.enviarParaStorage,
};

export interface SessaoExercicioInput {
  exercicio_id: string;
  duracao_segundos: number;
  pontuacao?: number;
  precisao_percentual?: number;
  detalhes?: Record<string, unknown> | null;
}

export interface SessaoExercicioPublica {
  id: string;
  user_id: string;
  exercicio_id: string;
  duracao_segundos: number;
  pontuacao: number;
  precisao_percentual: number;
  detalhes: Record<string, unknown> | null;
  created_at: string;
}

export const sessoesExercicioApi = {
  /** Grava uma sessão terminada. Nunca envia `user_id` — a API tira-o do
   *  cookie de sessão (o `profile.id` do browser deixou de ser fonte de
   *  verdade para isto). */
  registar: (dados: SessaoExercicioInput) =>
    pedido<SessaoExercicioPublica>("/sessoes-exercicio", {
      method: "POST",
      body: JSON.stringify(dados),
    }),
};

export interface ScreeningInput {
  estado: string;
  rosto_detetado: boolean;
  requer_avaliacao_humana: boolean;
  assimetria_horizontal?: number | null;
  assimetria_vertical?: number | null;
  qualidade_captura?: number | null;
  qualidade_fiavel?: boolean | null;
  qualidade_motivos?: string[];
  medicoes?: Record<string, unknown> | null;
  versao_analise?: string | null;
}

export interface ScreeningPublica {
  id: string;
  user_id: string;
  estado: string;
  rosto_detetado: boolean;
  requer_avaliacao_humana: boolean;
  assimetria_horizontal: number | null;
  assimetria_vertical: number | null;
  qualidade_captura: number | null;
  qualidade_fiavel: boolean | null;
  qualidade_motivos: string[];
  medicoes: Record<string, unknown> | null;
  versao_analise: string | null;
  criado_em: string;
}

export const screeningsApi = {
  /** Grava o resultado já calculado pelo janelas-scanner-api. Nunca envia a
   *  fotografia em si — só as medições (CLAUDE.md secção 4, regra 4). */
  registar: (dados: ScreeningInput) =>
    pedido<ScreeningPublica>("/screenings", {
      method: "POST",
      body: JSON.stringify(dados),
    }),

  listarMinhas: () => pedido<ScreeningPublica[]>("/screenings/minhas"),
};

export interface DoacaoPublica {
  id: string;
  recibo_id: string;
  tipo: string;
  email: string;
  materiais: string[] | null;
  detalhes: string | null;
  status: string;
  comprovativo_url: string | null;
  created_at: string;
}

export const doacoesApi = {
  registarMateriais: (email: string, materiais: string[], detalhes?: string | null) =>
    pedido<DoacaoPublica>("/doacoes/materiais", {
      method: "POST",
      body: JSON.stringify({ email, materiais, detalhes: detalhes || null }),
    }),

  /** `comprovativoChave` vem de `comprovativosApi.preparar` + upload já
   *  feito directamente ao R2 (ver CROSS-02) — nunca os bytes por aqui. */
  registarFinanceira: (email: string, detalhes: string | null, comprovativoChave: string) =>
    pedido<DoacaoPublica>("/doacoes/financeiro", {
      method: "POST",
      body: JSON.stringify({ email, detalhes, comprovativo_chave: comprovativoChave }),
    }),
};

export interface ContactMessagePublico {
  id: string;
  nome: string;
  email: string;
  assunto: string | null;
  mensagem: string;
  created_at: string;
}

export interface ContactMessageAdmin extends ContactMessagePublico {
  lida: boolean;
}

export const contactMessagesApi = {
  /** Formulário de contacto do site — público, não exige sessão. A
   *  notificação por email à equipa fica pendente (fornecedor por decidir);
   *  a mensagem em si já fica guardada. */
  enviar: (nome: string, email: string, mensagem: string, assunto?: string) =>
    pedido<ContactMessagePublico>("/contact-messages", {
      method: "POST",
      body: JSON.stringify({ nome, email, mensagem, assunto: assunto || undefined }),
    }),

  /** Leitura de admin — a API devolve 403 sem papel `admin`. */
  listar: () => pedido<ContactMessageAdmin[]>("/contact-messages"),

  marcarLida: (id: string, lida = true) =>
    pedido<ContactMessageAdmin>(`/contact-messages/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ lida }),
    }),
};

export interface FeedbackPublico {
  id: string;
  avaliacao: number;
  comentario: string | null;
  created_at: string;
}

export const feedbackApi = {
  /** Funciona sem sessão -- a API associa ao utilizador quando há cookie válido. */
  registar: (avaliacao: number, comentario?: string) =>
    pedido<FeedbackPublico>("/feedback", {
      method: "POST",
      body: JSON.stringify({ avaliacao, comentario: comentario || undefined }),
    }),
};

// --- Premium (W-11) --------------------------------------------------------

export interface PedidoPremioInput {
  nome: string;
  email: string;
  telefone?: string | null;
  plano?: string | null;
  // Chave devolvida por comprovativosApi.preparar, depois do PUT ao R2
  // já ter corrido.
  comprovativo_chave: string;
}

export interface PedidoPremiumPublico {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  plano: string | null;
  status: string;
  created_at: string;
}

export interface PedidoPremiumAdmin extends PedidoPremiumPublico {
  user_id: string | null;
  comprovativo_url: string | null;
  aprovado_por: string | null;
  aprovado_em: string | null;
}

export const premiumApi = {
  /** Formulário `RegistoPremium` — funciona com ou sem sessão; a API liga
   *  a conta quando há cookie. */
  pedir: (dados: PedidoPremioInput) =>
    pedido<PedidoPremiumPublico>("/premium-requests", {
      method: "POST",
      body: JSON.stringify(dados),
    }),

  /** Só admin. */
  listar: () => pedido<PedidoPremiumAdmin[]>("/premium-requests"),

  aprovar: (id: string) =>
    pedido<PedidoPremiumAdmin>(`/premium-requests/${id}/aprovar`, { method: "POST" }),

  revogar: (id: string) =>
    pedido<PedidoPremiumAdmin>(`/premium-requests/${id}/revogar`, { method: "POST" }),
};

// --- Administração de contas (W-11) --------------------------------------

export interface AdminUtilizador {
  id: string;
  email: string;
  nome_completo: string | null;
  papel: string;
  premium_ativo: boolean;
  criado_em: string;
}

export interface SerieDiaAdmin {
  dia: string;
  registos: number;
  sessoes: number;
  pedidos_premium: number;
}

export interface EstatisticasAdmin {
  total_utilizadores: number;
  novos_utilizadores: number;
  utilizadores_ativos_periodo: number;
  sessoes_exercicio: number;
  analises_scanner: number;
  pedidos_premium: number;
  mensagens_contacto: number;
  serie: SerieDiaAdmin[];
}

export interface PendenciasAdmin {
  pedidos_premium_pendentes: number;
  mensagens_por_ler: number;
  candidaturas_voluntariado_pendentes: number;
}

export interface SessaoExercicioAdmin {
  id: string;
  user_id: string;
  utilizador_nome: string | null;
  utilizador_email: string;
  exercicio_id: string;
  duracao_segundos: number;
  pontuacao: number;
  precisao_percentual: number;
  created_at: string;
}

export interface UtilizadorAtivoAdmin {
  user_id: string;
  utilizador_nome: string | null;
  utilizador_email: string;
  sessoes_no_periodo: number;
  ultima_sessao_em: string;
}

export const adminApi = {
  /** `dias`: só utilizadores registados nesse período — usado quando se vem
   *  do card "Novos utilizadores" do dashboard, mesma janela do filtro lá. */
  listarUtilizadores: (papel?: string, dias?: number) => {
    const params = new URLSearchParams();
    if (papel) params.set("papel", papel);
    if (dias) params.set("dias", String(dias));
    const query = params.toString();
    return pedido<AdminUtilizador[]>(`/admin/utilizadores${query ? `?${query}` : ""}`);
  },

  listarSessoesExercicio: (dias: number) =>
    pedido<SessaoExercicioAdmin[]>(`/admin/sessoes-exercicio?dias=${dias}`),

  listarAtivos: (dias: number) => pedido<UtilizadorAtivoAdmin[]>(`/admin/ativos?dias=${dias}`),

  /** Promove a conta com este email a `admin`. O primeiro admin cria-se por
   *  linha de comando (`python -m app.criar_admin`). */
  promover: (email: string) =>
    pedido<AdminUtilizador>("/admin/utilizadores/promover", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  removerAdmin: (id: string) =>
    pedido<AdminUtilizador>(`/admin/utilizadores/${id}/remover-admin`, { method: "POST" }),

  /** Nunca aceita `papel: "admin"` (a API recusa com 422) — para isso é
   *  sempre `promover`/`removerAdmin`, que têm a protecção do último admin. */
  definirPapel: (id: string, papel: string) =>
    pedido<AdminUtilizador>(`/admin/utilizadores/${id}/papel`, {
      method: "POST",
      body: JSON.stringify({ papel }),
    }),

  obterEstatisticas: (dias: number) => pedido<EstatisticasAdmin>(`/admin/estatisticas?dias=${dias}`),

  obterPendencias: () => pedido<PendenciasAdmin>("/admin/pendencias"),
};

// --- Voluntariado (W-12) ---------------------------------------------------

export interface CandidaturaVoluntariado {
  id: string;
  motivacao: string;
  telefone: string | null;
  status: string;
  decidido_em: string | null;
  created_at: string;
}

export interface CandidaturaVoluntariadoAdmin extends CandidaturaVoluntariado {
  utilizador_id: string;
  utilizador_email: string;
  utilizador_nome: string | null;
  decidido_por: string | null;
}

export interface AtividadeVoluntariado {
  id: string;
  titulo: string;
  descricao: string;
  local: string;
  data_inicio: string;
  data_fim: string | null;
  vagas: number | null;
  inscritos: number;
  estado: string;
  created_at: string;
}

export interface AtividadeVoluntariadoAdmin extends AtividadeVoluntariado {
  criado_por: string | null;
}

export interface InscricaoAtividade {
  id: string;
  atividade_id: string;
  atividade_titulo: string;
  atividade_data_inicio: string;
  atividade_local: string;
  estado: string;
  created_at: string;
}

export interface InscricaoAtividadeAdmin extends InscricaoAtividade {
  utilizador_id: string;
  utilizador_email: string;
  utilizador_nome: string | null;
}

export interface AtividadeVoluntariadoCriar {
  titulo: string;
  descricao: string;
  local: string;
  data_inicio: string;
  data_fim?: string | null;
  vagas?: number | null;
}

export const voluntariadoApi = {
  // Auto-serviço (voluntário) --------------------------------------------
  candidatar: (motivacao: string, telefone?: string) =>
    pedido<CandidaturaVoluntariado>("/voluntariado/candidatar", {
      method: "POST",
      body: JSON.stringify({ motivacao, telefone: telefone || undefined }),
    }),

  aMinhaCandidatura: () => pedido<CandidaturaVoluntariado | null>("/voluntariado/candidatura"),

  listarAtividades: () => pedido<AtividadeVoluntariado[]>("/voluntariado/atividades"),

  inscrever: (atividadeId: string) =>
    pedido<InscricaoAtividade>(`/voluntariado/atividades/${atividadeId}/inscrever`, { method: "POST" }),

  cancelarInscricao: (atividadeId: string) =>
    pedido<InscricaoAtividade>(`/voluntariado/atividades/${atividadeId}/inscrever`, { method: "DELETE" }),

  minhasInscricoes: () => pedido<InscricaoAtividade[]>("/voluntariado/minhas-inscricoes"),

  // Administração -----------------------------------------------------------
  listarCandidaturas: () => pedido<CandidaturaVoluntariadoAdmin[]>("/voluntariado/candidaturas"),

  aprovarCandidatura: (id: string) =>
    pedido<CandidaturaVoluntariadoAdmin>(`/voluntariado/candidaturas/${id}/aprovar`, { method: "POST" }),

  rejeitarCandidatura: (id: string) =>
    pedido<CandidaturaVoluntariadoAdmin>(`/voluntariado/candidaturas/${id}/rejeitar`, { method: "POST" }),

  listarTodasAsAtividades: () => pedido<AtividadeVoluntariadoAdmin[]>("/voluntariado/atividades/todas"),

  publicarAtividade: (dados: AtividadeVoluntariadoCriar) =>
    pedido<AtividadeVoluntariadoAdmin>("/voluntariado/atividades", {
      method: "POST",
      body: JSON.stringify(dados),
    }),

  cancelarAtividade: (id: string) =>
    pedido<AtividadeVoluntariadoAdmin>(`/voluntariado/atividades/${id}/cancelar`, { method: "POST" }),

  listarInscritos: (atividadeId: string) =>
    pedido<InscricaoAtividadeAdmin[]>(`/voluntariado/atividades/${atividadeId}/inscritos`),
};

// --- Publicações (ADMIN-03) --------------------------------------------------
// Substitui o padrão antigo de escrever uma página React nova por cada
// campanha/actividade (ver ActivitiesFeed.tsx) por um CMS real gerido no
// painel de administração.

export interface MidiaPublicacao {
  id: string;
  url: string;
  ordem: number;
}

export interface PublicacaoPublica {
  id: string;
  slug: string;
  titulo: string;
  resumo: string;
  corpo: string;
  local: string | null;
  data_evento: string | null;
  capa_url: string | null;
  midias: MidiaPublicacao[];
}

export interface PublicacaoAdmin extends PublicacaoPublica {
  estado: "rascunho" | "publicada";
  criado_por: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublicacaoCriarInput {
  titulo: string;
  resumo: string;
  corpo: string;
  local?: string | null;
  data_evento?: string | null;
}

export type PublicacaoAtualizarInput = Partial<PublicacaoCriarInput>;

export interface MidiaUploadPreparado {
  url_de_upload: string;
  chave: string;
  url_publico: string;
}

export const TIPOS_DE_MIDIA_ACEITES = ["image/png", "image/jpeg", "image/webp"] as const;

export const publicacoesApi = {
  // Leitura pública ---------------------------------------------------------
  listarPublicadas: () => pedido<PublicacaoPublica[]>("/publicacoes"),

  obterPorSlug: (slug: string) => pedido<PublicacaoPublica>(`/publicacoes/${slug}`),

  // Administração -------------------------------------------------------------
  listarTodas: () => pedido<PublicacaoAdmin[]>("/publicacoes/admin/todas"),

  criar: (dados: PublicacaoCriarInput) =>
    pedido<PublicacaoAdmin>("/publicacoes", { method: "POST", body: JSON.stringify(dados) }),

  atualizar: (id: string, dados: PublicacaoAtualizarInput) =>
    pedido<PublicacaoAdmin>(`/publicacoes/${id}`, { method: "PATCH", body: JSON.stringify(dados) }),

  publicar: (id: string) =>
    pedido<PublicacaoAdmin>(`/publicacoes/${id}/publicar`, { method: "POST" }),

  despublicar: (id: string) =>
    pedido<PublicacaoAdmin>(`/publicacoes/${id}/despublicar`, { method: "POST" }),

  apagar: (id: string) => pedido<void>(`/publicacoes/${id}`, { method: "DELETE" }),

  // Fotos (capa + galeria) — mesmo fluxo de 3 passos do avatar --------------
  prepararCapa: (publicacaoId: string, contentType: string) =>
    pedido<MidiaUploadPreparado>(`/publicacoes/${publicacaoId}/capa/preparar`, {
      method: "POST",
      body: JSON.stringify({ content_type: contentType }),
    }),

  confirmarCapa: (publicacaoId: string, chave: string) =>
    pedido<{ capa_url: string }>(`/publicacoes/${publicacaoId}/capa/confirmar`, {
      method: "POST",
      body: JSON.stringify({ chave }),
    }),

  prepararMidia: (publicacaoId: string, contentType: string) =>
    pedido<MidiaUploadPreparado>(`/publicacoes/${publicacaoId}/midias/preparar`, {
      method: "POST",
      body: JSON.stringify({ content_type: contentType }),
    }),

  confirmarMidia: (publicacaoId: string, chave: string) =>
    pedido<MidiaPublicacao>(`/publicacoes/${publicacaoId}/midias/confirmar`, {
      method: "POST",
      body: JSON.stringify({ chave }),
    }),

  removerMidia: (publicacaoId: string, midiaId: string) =>
    pedido<void>(`/publicacoes/${publicacaoId}/midias/${midiaId}`, { method: "DELETE" }),

  /** Envio directo ao storage — fora do `apiClient` de propósito (outra
   *  origem, sem cookies, corpo binário). Reutiliza a mesma lógica de
   *  `uploadsApi.enviarParaStorage`. */
  enviarParaStorage: uploadsApi.enviarParaStorage,
};

// --- Notificações (ADMIN-04) --------------------------------------------------
// Substitui o antigo AdminNotifications.tsx, que escrevia numa tabela do
// Supabase sem nenhum consumidor real do lado do site.

export interface NotificacaoPublica {
  id: string;
  titulo: string;
  mensagem: string;
  lida: boolean;
  created_at: string;
}

export const PAPEIS_PARA_NOTIFICAR = [
  "comum",
  "estrabico",
  "profissional",
  "oftalmologista",
  "voluntario",
  "admin",
] as const;

export const notificacoesApi = {
  // Qualquer sessão autenticada -- só vê as suas próprias.
  listarMinhas: () => pedido<NotificacaoPublica[]>("/notificacoes"),

  contarNaoLidas: () => pedido<{ contagem: number }>("/notificacoes/nao-lidas/contagem"),

  marcarLida: (id: string) =>
    pedido<NotificacaoPublica>(`/notificacoes/${id}/marcar-lida`, { method: "POST" }),

  marcarTodasLidas: () => pedido<void>("/notificacoes/marcar-todas-lidas", { method: "POST" }),

  // Administração -- envia (broadcast) a todos ou a um papel. `enviarEmail`
  // é além da notificação no sino (que acontece sempre) -- nunca em vez
  // dela.
  enviar: (titulo: string, mensagem: string, papel?: string | null, enviarEmail?: boolean) =>
    pedido<{ enviadas: number; emails_enviados: number; emails_falharam: number }>(
      "/notificacoes/admin/enviar",
      {
        method: "POST",
        body: JSON.stringify({ titulo, mensagem, papel: papel || null, enviar_email: !!enviarEmail }),
      }
    ),
};

export type RespostaOpcaoJogo = "A" | "B" | "C" | "D";

export interface PerguntaJogoPublica {
  id: string;
  texto_pergunta: string;
  opcao_a: string;
  opcao_b: string;
  opcao_c: string;
  opcao_d: string;
}

export interface ValidarRespostaJogoResponse {
  correta: boolean;
  resposta_correta: RespostaOpcaoJogo;
  explicacao: string | null;
}

export interface PerfilJogadorPublico {
  moedas: number;
  diamantes: number;
  partidas_jogadas: number;
  patamar_maximo_alcancado: number;
}

export const jogoApi = {
  // `patamar` (1-15) é só do jogo -- o backend mapeia-o para um dos 3 níveis
  // de dificuldade da reserva de perguntas (ver nivel_dificuldade_do_patamar).
  obterPerguntaAleatoria: (patamar: number) =>
    pedido<PerguntaJogoPublica>(`/jogo/pergunta-aleatoria?patamar=${patamar}`),

  // A resposta certa nunca chega em `obterPerguntaAleatoria` -- só esta
  // chamada, depois de o jogador já ter escolhido, é que a revela.
  validarResposta: (perguntaId: string, respostaUsuario: RespostaOpcaoJogo) =>
    pedido<ValidarRespostaJogoResponse>("/jogo/validar", {
      method: "POST",
      body: JSON.stringify({ pergunta_id: perguntaId, resposta_usuario: respostaUsuario }),
    }),

  // Exige sessão -- só tem sentido para quem tem conta (ver `useProfile`).
  obterPerfil: () => pedido<PerfilJogadorPublico>("/jogo/perfil"),

  // Sem corpo nenhum -- o servidor paga com base no progresso que ele
  // próprio rastreou a partir de respostas certas confirmadas em
  // `validarResposta` (ver JogoService), nunca num patamar que o cliente
  // diga ter alcançado. Corrigido 2026-09-23: antes disto o patamar vinha
  // do corpo do pedido, e dava para "inventar" prémios com um pedido forjado.
  registarRecompensa: () => pedido<PerfilJogadorPublico>("/jogo/recompensas", { method: "POST" }),
};
