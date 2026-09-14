import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

// --- mocks: controlamos as respostas da API sem tocar em fetch nenhum ---
// O import de AuthContext vem DEPOIS do vi.mock (mais abaixo neste
// ficheiro) — ver a nota equivalente em Configuracoes.test.tsx sobre a
// ordem de execução dos módulos no Vitest.

const eu = vi.fn();
const entrar = vi.fn();
const registar = vi.fn();
const sair = vi.fn();
const toastSuccess = vi.fn();

vi.mock("@/lib/apiClient", () => ({
  authApi: {
    eu: () => eu(),
    entrar: (email: string, password: string) => entrar(email, password),
    registar: (dados: unknown) => registar(dados),
    sair: () => sair(),
  },
  // Implementação real (não é preciso mockar) -- duck-typing puro, sem
  // depender de nenhuma classe do módulo real.
  mensagemDeErroApi: (err: unknown, fallback: string) => {
    const status = (err as { status?: unknown } | null)?.status;
    const message = (err as { message?: unknown } | null)?.message;
    return typeof status === "number" && typeof message === "string" ? message : fallback;
  },
}));

vi.mock("sonner", () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: vi.fn(), info: vi.fn() },
}));

import { AuthProvider, useAuth } from "./AuthContext";

// AuthContext.tsx distingue "a API respondeu com uma mensagem específica" de
// "algo mais correu mal" por duck-typing (propriedade `status`), não por
// `instanceof ApiError` — não há nenhuma classe real para construir aqui.
const erroApi = (status: number, message: string) => Object.assign(new Error(message), { status });

const UTILIZADOR_API = {
  id: "user-1",
  email: "ana@example.com",
  papel: "comum",
  nome_completo: "Ana Teste",
  provincia: "Luanda",
  genero: "feminino",
  criado_em: "2026-01-01T00:00:00.000Z",
  email_confirmado: true,
  eliminacao_cancelada: false,
};

function renderAuth() {
  return renderHook(() => useAuth(), { wrapper: AuthProvider });
}

describe("AuthContext", () => {
  beforeEach(() => {
    eu.mockReset();
    entrar.mockReset();
    registar.mockReset();
    sair.mockReset();
    sair.mockResolvedValue(undefined);
    toastSuccess.mockReset();
  });

  it("começa com loading=true e sem utilizador", () => {
    eu.mockReturnValue(new Promise(() => {})); // nunca resolve neste teste
    const { result } = renderAuth();

    expect(result.current.loading).toBe(true);
    expect(result.current.isLoggedIn).toBe(false);
  });

  it("recupera a sessão existente ao abrir a app, via /auth/eu", async () => {
    eu.mockResolvedValue(UTILIZADOR_API);
    const { result } = renderAuth();

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isLoggedIn).toBe(true);
    expect(result.current.user?.email).toBe("ana@example.com");
    expect(result.current.user?.name).toBe("Ana Teste");
  });

  it("sem sessão (/auth/eu falha), fica por não-autenticado — nunca lança", async () => {
    eu.mockRejectedValue(erroApi(401, "sem sessão"));
    const { result } = renderAuth();

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isLoggedIn).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it("signIn com credenciais certas autentica o utilizador", async () => {
    eu.mockRejectedValue(erroApi(401, "sem sessão"));
    entrar.mockResolvedValue(UTILIZADOR_API);
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.loading).toBe(false));

    let resultado: { ok: boolean; error?: string } | undefined;
    await act(async () => {
      resultado = await result.current.signIn("ana@example.com", "password-forte-123");
    });

    expect(resultado).toEqual({ ok: true });
    expect(result.current.isLoggedIn).toBe(true);
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("signIn avisa quando entrar cancelou uma eliminação de conta agendada", async () => {
    eu.mockRejectedValue(erroApi(401, "sem sessão"));
    entrar.mockResolvedValue({ ...UTILIZADOR_API, eliminacao_cancelada: true });
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.signIn("ana@example.com", "password-forte-123");
    });

    expect(toastSuccess).toHaveBeenCalledWith(
      "A eliminação da sua conta foi cancelada. Bem-vindo de volta."
    );
  });

  it("signIn com credenciais erradas devolve o erro e nunca autentica", async () => {
    eu.mockRejectedValue(erroApi(401, "sem sessão"));
    entrar.mockRejectedValue(erroApi(401, "email ou password incorretos"));
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.loading).toBe(false));

    let resultado: { ok: boolean; error?: string } | undefined;
    await act(async () => {
      resultado = await result.current.signIn("ana@example.com", "errada");
    });

    expect(resultado).toEqual({ ok: false, error: "email ou password incorretos" });
    expect(result.current.isLoggedIn).toBe(false);
  });

  it("registerUser cria conta mas AUTH-02 nunca entra automaticamente (a conta fica por confirmar)", async () => {
    eu.mockRejectedValue(erroApi(401, "sem sessão"));
    registar.mockResolvedValue({ ...UTILIZADOR_API, email_confirmado: false });
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.loading).toBe(false));

    let resultado: { ok: boolean; error?: string } | undefined;
    await act(async () => {
      resultado = await result.current.registerUser({
        name: "Ana Teste",
        email: "ana@example.com",
        password: "password-forte-123",
        province: "Luanda",
        gender: "feminino",
        role: "comum",
      });
    });

    expect(resultado).toEqual({ ok: true });
    // A API não define cookies para uma conta por confirmar -- nunca fingir
    // aqui que há sessão só porque o registo correu bem.
    expect(result.current.isLoggedIn).toBe(false);
    expect(registar).toHaveBeenCalledWith({
      email: "ana@example.com",
      password: "password-forte-123",
      nome_completo: "Ana Teste",
      provincia: "Luanda",
      genero: "feminino",
      papel: "comum",
    });
  });

  it("registerUser com email já registado devolve o erro sem autenticar", async () => {
    eu.mockRejectedValue(erroApi(401, "sem sessão"));
    registar.mockRejectedValue(erroApi(409, "o email já está registado"));
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.loading).toBe(false));

    let resultado: { ok: boolean; error?: string } | undefined;
    await act(async () => {
      resultado = await result.current.registerUser({
        name: "Ana Teste",
        email: "ana@example.com",
        password: "password-forte-123",
        province: "Luanda",
        gender: "feminino",
        role: "comum",
      });
    });

    expect(resultado).toEqual({ ok: false, error: "o email já está registado" });
    expect(result.current.isLoggedIn).toBe(false);
  });

  it("logout limpa o utilizador localmente mesmo que o pedido à API falhe", async () => {
    eu.mockResolvedValue(UTILIZADOR_API);
    sair.mockRejectedValue(new Error("rede em baixo"));
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.isLoggedIn).toBe(true));

    act(() => {
      result.current.logout();
    });

    expect(result.current.isLoggedIn).toBe(false);
    expect(result.current.user).toBeNull();
  });
});
