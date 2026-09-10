/**
 * Cliente fino para a API própria (FastAPI). Nunca guarda tokens — a sessão
 * viaja em cookies `httpOnly` que o browser gere sozinho; por isso todo o
 * pedido leva `credentials: "include"`, e não há "access token" nenhum para
 * este módulo tocar.
 *
 * Ver CLAUDE.md secção 0 — autenticação, perfil e banners já estão
 * migrados. O resto dos dados (sessões de exercício, scanner, doações, ...)
 * continua a vir de `src/integrations/supabase/client.ts` enquanto a
 * migração módulo-a-módulo não chega lá.
 */

// Mesma origem por omissão: `/api/*` é servido pelo NGINX nos containers e
// pelo proxy do Vite em `npm run dev` (ver vite.config.ts), ambos a reencaminhar
// para a API. É o que torna o cookie `httpOnly` de sessão utilizável sem CORS.
// `VITE_API_URL` só é preciso para apontar o dev a uma API remota.
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

async function pedido<T>(caminho: string, opcoes: RequestInit = {}): Promise<T> {
  const resposta = await fetch(`${API_URL}${caminho}`, {
    ...opcoes,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...opcoes.headers },
  });

  if (!resposta.ok) {
    let mensagem = "Ocorreu um erro. Tente novamente.";
    try {
      mensagem = mensagemDeErro(await resposta.json()) ?? mensagem;
    } catch {
      // corpo vazio ou não-JSON — fica a mensagem genérica
    }
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

  eu: () => pedido<UtilizadorPublico>("/auth/eu"),

  sair: () => pedido<void>("/auth/sair", { method: "POST" }),

  atualizarToken: () => pedido<void>("/auth/atualizar-token", { method: "POST" }),
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

export interface DoacaoPublica {
  id: string;
  recibo_id: string;
  tipo: string;
  email: string;
  materiais: string[] | null;
  detalhes: string | null;
  status: string;
  created_at: string;
}

export const doacoesApi = {
  registarMateriais: (email: string, materiais: string[], detalhes?: string | null) =>
    pedido<DoacaoPublica>("/doacoes/materiais", {
      method: "POST",
      body: JSON.stringify({ email, materiais, detalhes: detalhes || null }),
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
