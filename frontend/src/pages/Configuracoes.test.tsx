import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

// --- mocks: isolamos Configuracoes.tsx da API real e do resto da app ---

class ApiErrorFalso extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const mudarPassword = vi.fn();
const eliminar = vi.fn();
const atualizarPerfil = vi.fn();

// mensagemDeErroApi é duck-typing puro (propriedade `status`) -- não precisa
// de ApiError real nem mockado para funcionar correctamente aqui.
vi.mock("@/lib/apiClient", () => ({
  contaApi: {
    mudarPassword: (a: string, b: string) => mudarPassword(a, b),
    eliminar: () => eliminar(),
  },
  perfilApi: {
    atualizar: (dados: unknown) => atualizarPerfil(dados),
  },
  mensagemDeErroApi: (err: unknown, fallback: string) => {
    const status = (err as { status?: unknown } | null)?.status;
    const message = (err as { message?: unknown } | null)?.message;
    return typeof status === "number" && typeof message === "string" ? message : fallback;
  },
}));

// Navbar chama isto directamente (ainda não migrado para a API nova) —
// sem mockar, tentaria falar com o Supabase de verdade.
vi.mock("@/hooks/useSupabaseRole", () => ({
  useSupabaseRole: () => ({ isAdmin: false }),
}));

const mockProfile = {
  id: "user-1",
  nome_completo: "Ana Teste",
  email: "ana@example.com",
  biografia: null,
  data_nascimento: null,
  genero: null,
  telefone: null,
  provincia: null,
  avatar_url: null,
  papel: "comum",
  notificacoes_projetos: false,
  notificacoes_lembretes: false,
  notificacoes_comunidade: false,
  created_at: "2026-01-01T00:00:00.000Z",
};

const setProfile = vi.fn();
vi.mock("@/contexts/ProfileContext", () => ({
  useProfile: () => ({ profile: mockProfile, loading: false, refetch: vi.fn(), setProfile }),
}));

const logout = vi.fn();
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isLoggedIn: true, logout: (...a: unknown[]) => logout(...a) }),
}));

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...a: unknown[]) => toastError(...a), success: (...a: unknown[]) => toastSuccess(...a) },
}));

import Configuracoes from "./Configuracoes";

async function abrirDialogoPassword(user: ReturnType<typeof userEvent.setup>) {
  const botao = await screen.findByText("Mudar Palavra-passe");
  await user.click(botao);
  return {
    actual: await screen.findByLabelText("Palavra-passe atual"),
    nova: screen.getByLabelText("Nova palavra-passe"),
    confirmar: screen.getByLabelText("Confirmar nova palavra-passe"),
    guardar: screen.getByRole("button", { name: /^Guardar$/ }),
  };
}

describe("Configuracoes — mudar palavra-passe", () => {
  beforeEach(() => {
    mudarPassword.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
  });

  it("recusa quando a palavra-passe actual está errada, e o dialogo continua aberto", async () => {
    mudarPassword.mockRejectedValue(new ApiErrorFalso(401, "password atual incorreta"));
    const user = userEvent.setup();
    render(<Configuracoes />, { wrapper: MemoryRouter });

    const { actual, nova, confirmar, guardar } = await abrirDialogoPassword(user);
    await user.type(actual, "palavra-errada");
    await user.type(nova, "novaSenha123");
    await user.type(confirmar, "novaSenha123");
    await user.click(guardar);

    await waitFor(() => expect(mudarPassword).toHaveBeenCalledWith("palavra-errada", "novaSenha123"));
    expect(toastError).toHaveBeenCalledWith("password atual incorreta");
    expect(toastSuccess).not.toHaveBeenCalled();
    // o dialogo continua aberto — o utilizador nunca viu "sucesso" para algo que falhou
    expect(screen.getByLabelText("Palavra-passe atual")).toBeInTheDocument();
  });

  it("mostra sucesso real só depois de a API confirmar a mudança", async () => {
    mudarPassword.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<Configuracoes />, { wrapper: MemoryRouter });

    const { actual, nova, confirmar, guardar } = await abrirDialogoPassword(user);
    await user.type(actual, "senhaCerta1");
    await user.type(nova, "novaSenha123");
    await user.type(confirmar, "novaSenha123");
    await user.click(guardar);

    await waitFor(() => expect(mudarPassword).toHaveBeenCalledWith("senhaCerta1", "novaSenha123"));
    expect(toastError).not.toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalledWith("Palavra-passe atualizada com sucesso.");
  });

  it("nunca chama a API se as novas palavras-passe não coincidirem", async () => {
    const user = userEvent.setup();
    render(<Configuracoes />, { wrapper: MemoryRouter });

    const { actual, nova, confirmar, guardar } = await abrirDialogoPassword(user);
    await user.type(actual, "senhaCerta1");
    await user.type(nova, "novaSenha123");
    await user.type(confirmar, "outraCoisa");
    await user.click(guardar);

    expect(mudarPassword).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("Verifique os campos da palavra-passe.");
  });

  it("nunca chama a API se a nova palavra-passe for demasiado curta", async () => {
    const user = userEvent.setup();
    render(<Configuracoes />, { wrapper: MemoryRouter });

    const { actual, nova, confirmar, guardar } = await abrirDialogoPassword(user);
    await user.type(actual, "senhaCerta1");
    await user.type(nova, "curta12");
    await user.type(confirmar, "curta12");
    await user.click(guardar);

    expect(mudarPassword).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("A palavra-passe deve ter pelo menos 8 caracteres.");
  });

  it("nunca chama a API se a nova palavra-passe não tiver letras nem números (AUTH-01)", async () => {
    const user = userEvent.setup();
    render(<Configuracoes />, { wrapper: MemoryRouter });

    const { actual, nova, confirmar, guardar } = await abrirDialogoPassword(user);
    await user.type(actual, "senhaCerta1");
    await user.type(nova, "12345678");
    await user.type(confirmar, "12345678");
    await user.click(guardar);

    expect(mudarPassword).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("A palavra-passe precisa de pelo menos uma letra.");
  });
});

async function abrirDialogoEliminar(user: ReturnType<typeof userEvent.setup>) {
  // "Eliminar Conta" aparece duas vezes (o rótulo e o botão) — ser específico ao papel.
  const botao = await screen.findByRole("button", { name: /Eliminar Conta/i });
  await user.click(botao);
  return {
    confirmar: await screen.findByRole("button", { name: /^Agendar eliminação$/ }),
  };
}

describe("Configuracoes — eliminar conta (agendada a 30 dias)", () => {
  beforeEach(() => {
    eliminar.mockReset();
    logout.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
  });

  it("nunca faz logout nem mostra sucesso se agendar falhar", async () => {
    eliminar.mockRejectedValue(new ApiErrorFalso(500, "boom"));
    const user = userEvent.setup();
    render(<Configuracoes />, { wrapper: MemoryRouter });

    const { confirmar } = await abrirDialogoEliminar(user);
    await user.click(confirmar);

    await waitFor(() => expect(eliminar).toHaveBeenCalled());
    expect(logout).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("boom");
    // o dialogo de confirmação continua visível — não fechou sozinho
    expect(screen.getByRole("button", { name: /^Agendar eliminação$/ })).toBeInTheDocument();
  });

  it("agenda para daqui a 30 dias, faz logout e mostra sucesso — nunca apaga na hora", async () => {
    eliminar.mockResolvedValue({ agendada_para: "2026-10-09T00:00:00.000Z" });
    const user = userEvent.setup();
    render(<Configuracoes />, { wrapper: MemoryRouter });

    const { confirmar } = await abrirDialogoEliminar(user);
    await user.click(confirmar);

    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
    expect(toastError).not.toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalledWith(
      "Conta agendada para eliminação dentro de 30 dias. Iniciar sessão de novo antes dessa data cancela o pedido."
    );
    // Nunca chama uma função de eliminação imediata — só agenda.
    expect(eliminar).toHaveBeenCalledTimes(1);
  });
});
