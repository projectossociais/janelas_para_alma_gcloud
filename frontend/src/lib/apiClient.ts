/**
 * Cliente fino para a API própria (FastAPI). Nunca guarda tokens — a sessão
 * viaja em cookies `httpOnly` que o browser gere sozinho; por isso todo o
 * pedido leva `credentials: "include"`, e não há "access token" nenhum para
 * este módulo tocar.
 *
 * Ver CLAUDE.md secção 0 — autenticação e perfil já estão migrados. O resto
 * dos dados (sessões de exercício, scanner, doações, ...) continua a vir de
 * `src/integrations/supabase/client.ts` enquanto a migração módulo-a-módulo
 * não chega lá.
 */

const API_URL = import.meta.env.VITE_API_URL ?? "";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
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
