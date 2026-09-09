import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

// --- mocks ---
// Este é o fluxo com o histórico mais grave do projecto (ver CLAUDE.md,
// "Nunca mostrar sucesso antes de verificar error/excepção") — o teste que
// importa aqui é especificamente o caminho do erro, não só o do sucesso.

const registarMateriais = vi.fn();

vi.mock("@/lib/apiClient", () => ({
  doacoesApi: { registarMateriais: (...a: unknown[]) => registarMateriais(...a) },
  mensagemDeErroApi: (err: unknown, fallback: string) => {
    const status = (err as { status?: unknown } | null)?.status;
    const message = (err as { message?: unknown } | null)?.message;
    return typeof status === "number" && typeof message === "string" ? message : fallback;
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: vi.fn() } },
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

describe("Apoiar — doação de materiais", () => {
  beforeEach(() => {
    registarMateriais.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("nunca mostra sucesso quando a API falha ao registar a doação", async () => {
    registarMateriais.mockRejectedValue(Object.assign(new Error("falha ao gravar"), { status: 500 }));
    const user = userEvent.setup();
    render(<Apoiar />, { wrapper: MemoryRouter });

    const confirmar = await abrirDialogoDeMateriais(user);
    await user.click(confirmar);

    await waitFor(() => expect(registarMateriais).toHaveBeenCalled());
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("falha ao gravar");
    // o dialogo continua no passo de formulário -- nunca avançou para o
    // ecrã de "recolha" (que só devia aparecer com uma doação confirmada)
    expect(screen.getByLabelText(/O seu email para contacto/i)).toBeInTheDocument();
  });

  it("só mostra sucesso depois de a API confirmar o registo, com o recibo do servidor", async () => {
    registarMateriais.mockResolvedValue({
      id: "doacao-1",
      recibo_id: "JPA-ABC123",
      tipo: "materiais",
      email: "doador@example.com",
      materiais: ["armacoes"],
      detalhes: null,
      status: "pendente",
      created_at: "2026-01-01T00:00:00.000Z",
    });
    const user = userEvent.setup();
    render(<Apoiar />, { wrapper: MemoryRouter });

    const confirmar = await abrirDialogoDeMateriais(user);
    await user.click(confirmar);

    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(toastError).not.toHaveBeenCalled();
    expect(registarMateriais).toHaveBeenCalledWith("doador@example.com", ["armacoes"], "");
  });
});
