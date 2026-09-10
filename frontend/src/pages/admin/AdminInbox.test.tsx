import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const listar = vi.fn();
const marcarLida = vi.fn();

vi.mock("@/lib/apiClient", () => ({
  contactMessagesApi: {
    listar: (...a: unknown[]) => listar(...a),
    marcarLida: (...a: unknown[]) => marcarLida(...a),
  },
  mensagemDeErroApi: (err: unknown, fallback: string) => {
    const status = (err as { status?: unknown } | null)?.status;
    const message = (err as { message?: unknown } | null)?.message;
    return typeof status === "number" && typeof message === "string" ? message : fallback;
  },
}));

// O separador de Pedidos Premium continua no Supabase — mockado só para não
// sair pela rede neste teste.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({ order: () => Promise.resolve({ data: [] }) }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  },
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));

import AdminInbox from "./AdminInbox";

const umaMensagem = {
  id: "msg-1",
  nome: "Ana Silva",
  email: "ana@example.com",
  assunto: null,
  mensagem: "Tenho uma dúvida.",
  lida: false,
  created_at: "2026-01-01T10:00:00.000Z",
};

describe("AdminInbox — mensagens de contacto", () => {
  beforeEach(() => {
    listar.mockReset();
    marcarLida.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("mostra um erro (e não rebenta) quando a listagem falha", async () => {
    listar.mockRejectedValue(Object.assign(new Error("Sem permissões"), { status: 403 }));
    render(<AdminInbox />);

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Sem permissões"));
    expect(screen.getByText("Sem mensagens.")).toBeInTheDocument();
  });

  it("marca uma mensagem como tratada e recarrega a lista", async () => {
    listar.mockResolvedValueOnce([umaMensagem]).mockResolvedValueOnce([{ ...umaMensagem, lida: true }]);
    marcarLida.mockResolvedValue({ ...umaMensagem, lida: true });
    const user = userEvent.setup();
    render(<AdminInbox />);

    const botao = await screen.findByRole("button", { name: /Marcar tratada/i });
    await user.click(botao);

    await waitFor(() => expect(marcarLida).toHaveBeenCalledWith("msg-1"));
    expect(toastSuccess).toHaveBeenCalledWith("Marcada como tratada.");
    await waitFor(() => expect(listar).toHaveBeenCalledTimes(2));
  });

  it("nunca mostra sucesso se marcar como tratada falhar", async () => {
    listar.mockResolvedValue([umaMensagem]);
    marcarLida.mockRejectedValue(Object.assign(new Error("Falhou"), { status: 500 }));
    const user = userEvent.setup();
    render(<AdminInbox />);

    await user.click(await screen.findByRole("button", { name: /Marcar tratada/i }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Falhou"));
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
