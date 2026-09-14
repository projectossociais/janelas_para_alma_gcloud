import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

// --- mocks ---
// Este é o fluxo com o histórico mais grave do projecto (ver CLAUDE.md,
// "Nunca mostrar sucesso antes de verificar error/excepção") — o que importa
// aqui é especificamente o caminho do erro, não só o do sucesso. A doação de
// materiais foi unificada de volta ao Supabase (mesmo caminho do fluxo
// financeiro: insert em `doacoes` + Edge Function `enviar-email-doacao`)
// enquanto a infra de email em Python não está pronta — ver docs/BACKLOG.md.

const fromMock = vi.fn();
const insertMock = vi.fn();
const invokeMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => {
      fromMock(...args);
      return { insert: (...a: unknown[]) => insertMock(...a) };
    },
    functions: { invoke: (...args: unknown[]) => invokeMock(...args) },
  },
}));

vi.mock("@/hooks/useSupabaseRole", () => ({
  useSupabaseRole: () => ({ isAdmin: false }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isLoggedIn: false, user: null, logout: vi.fn() }),
}));

vi.mock("@/contexts/ProfileContext", () => ({
  useProfile: () => ({ profile: null, loading: false, refetch: vi.fn(), setProfile: vi.fn() }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a) },
}));

import Apoiar from "./Apoiar";

async function abrirDialogoDeMateriais(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /Armações/i }));
  await user.click(screen.getByRole("button", { name: /^Confirmar Doação de Materiais$/ }));
  const email = await screen.findByLabelText(/O seu email para contacto/i);
  await user.type(email, "doador@example.com");
  return screen.getByRole("button", { name: /Confirmar Doação|A enviar/ });
}

describe("Apoiar — doação de materiais (Supabase)", () => {
  beforeEach(() => {
    fromMock.mockReset();
    insertMock.mockReset();
    invokeMock.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("nunca mostra sucesso quando a gravação em `doacoes` falha", async () => {
    insertMock.mockResolvedValue({ error: new Error("falha ao gravar") });
    const user = userEvent.setup();
    render(<Apoiar />, { wrapper: MemoryRouter });

    const confirmar = await abrirDialogoDeMateriais(user);
    await user.click(confirmar);

    await waitFor(() => expect(insertMock).toHaveBeenCalled());
    expect(invokeMock).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("falha ao gravar");
    // o dialogo continua no passo de formulário -- nunca avançou para o
    // ecrã de "recolha" (que só devia aparecer com uma doação confirmada)
    expect(screen.getByLabelText(/O seu email para contacto/i)).toBeInTheDocument();
  });

  it("nunca mostra sucesso quando a gravação passa mas o envio do email falha", async () => {
    insertMock.mockResolvedValue({ error: null });
    invokeMock.mockResolvedValue({ error: new Error("falha ao enviar email") });
    const user = userEvent.setup();
    render(<Apoiar />, { wrapper: MemoryRouter });

    const confirmar = await abrirDialogoDeMateriais(user);
    await user.click(confirmar);

    await waitFor(() => expect(invokeMock).toHaveBeenCalled());
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("falha ao enviar email");
    expect(screen.getByLabelText(/O seu email para contacto/i)).toBeInTheDocument();
  });

  it("só mostra sucesso depois de gravar em `doacoes` e confirmar o envio do email", async () => {
    insertMock.mockResolvedValue({ error: null });
    invokeMock.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<Apoiar />, { wrapper: MemoryRouter });

    const confirmar = await abrirDialogoDeMateriais(user);
    await user.click(confirmar);

    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(toastError).not.toHaveBeenCalled();

    expect(fromMock).toHaveBeenCalledWith("doacoes");
    expect(insertMock).toHaveBeenCalledWith([
      expect.objectContaining({
        tipo: "materiais",
        email: "doador@example.com",
        materiais: ["armacoes"],
        status: "pendente",
      }),
    ]);
    expect(invokeMock).toHaveBeenCalledWith(
      "enviar-email-doacao",
      expect.objectContaining({
        body: expect.objectContaining({
          tipo: "materiais",
          email: "doador@example.com",
          materiais: ["armacoes"],
        }),
      }),
    );
  });
});
