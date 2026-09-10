import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const listar = vi.fn();
const marcarLida = vi.fn();
const premiumListar = vi.fn();
const premiumAprovar = vi.fn();
const premiumRevogar = vi.fn();

vi.mock("@/lib/apiClient", () => ({
  contactMessagesApi: {
    listar: (...a: unknown[]) => listar(...a),
    marcarLida: (...a: unknown[]) => marcarLida(...a),
  },
  premiumApi: {
    listar: (...a: unknown[]) => premiumListar(...a),
    aprovar: (...a: unknown[]) => premiumAprovar(...a),
    revogar: (...a: unknown[]) => premiumRevogar(...a),
  },
  mensagemDeErroApi: (err: unknown, fallback: string) => {
    const status = (err as { status?: unknown } | null)?.status;
    const message = (err as { message?: unknown } | null)?.message;
    return typeof status === "number" && typeof message === "string" ? message : fallback;
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

async function abrirSeparadorPremium(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("tab", { name: /Pedidos Premium/i }));
}

const umaMensagem = {
  id: "msg-1",
  nome: "Ana Silva",
  email: "ana@example.com",
  assunto: null,
  mensagem: "Tenho uma dúvida.",
  lida: false,
  created_at: "2026-01-01T10:00:00.000Z",
};

const umPedido = {
  id: "ped-1",
  nome: "Rui Premium",
  email: "rui@example.com",
  telefone: null,
  plano: "mensal",
  status: "pendente",
  created_at: "2026-01-02T10:00:00.000Z",
  user_id: "user-9",
  aprovado_por: null,
  aprovado_em: null,
};

describe("AdminInbox — mensagens de contacto", () => {
  beforeEach(() => {
    listar.mockReset().mockResolvedValue([]);
    marcarLida.mockReset();
    premiumListar.mockReset().mockResolvedValue([]);
    premiumAprovar.mockReset();
    premiumRevogar.mockReset();
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

  it("aprova um pagamento Premium e recarrega os pedidos", async () => {
    premiumListar
      .mockResolvedValueOnce([umPedido])
      .mockResolvedValueOnce([{ ...umPedido, status: "aprovado" }]);
    premiumAprovar.mockResolvedValue({ ...umPedido, status: "aprovado" });
    const user = userEvent.setup();
    render(<AdminInbox />);

    await abrirSeparadorPremium(user);
    await user.click(await screen.findByRole("button", { name: /Aprovar pagamento/i }));

    await waitFor(() => expect(premiumAprovar).toHaveBeenCalledWith("ped-1"));
    expect(toastSuccess).toHaveBeenCalledWith("Pagamento aprovado — Premium activo por 30 dias.");
    await waitFor(() => expect(premiumListar).toHaveBeenCalledTimes(2));
  });

  it("nunca mostra sucesso se aprovar o pagamento falhar", async () => {
    premiumListar.mockResolvedValue([umPedido]);
    premiumAprovar.mockRejectedValue(Object.assign(new Error("já aprovado"), { status: 409 }));
    const user = userEvent.setup();
    render(<AdminInbox />);

    await abrirSeparadorPremium(user);
    await user.click(await screen.findByRole("button", { name: /Aprovar pagamento/i }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("já aprovado"));
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("desactiva o botão de aprovar quando o pedido não tem conta ligada", async () => {
    premiumListar.mockResolvedValue([{ ...umPedido, user_id: null }]);
    const user = userEvent.setup();
    render(<AdminInbox />);

    await abrirSeparadorPremium(user);
    const botao = await screen.findByRole("button", { name: /Aprovar pagamento/i });
    expect(botao).toBeDisabled();
  });
});
