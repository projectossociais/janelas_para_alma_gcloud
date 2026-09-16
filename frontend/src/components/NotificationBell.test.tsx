import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ADMIN-04: o sino é o consumidor real que faltava -- o que importa testar
// é a contagem de não lidas e que marcar como lida actualiza a UI sem
// esperar por um novo pedido (e nunca esconde uma falha como sucesso).

const contarNaoLidas = vi.fn();
const listarMinhas = vi.fn();
const marcarLida = vi.fn();
const marcarTodasLidas = vi.fn();

vi.mock("@/lib/apiClient", () => ({
  notificacoesApi: {
    contarNaoLidas: (...a: unknown[]) => contarNaoLidas(...a),
    listarMinhas: (...a: unknown[]) => listarMinhas(...a),
    marcarLida: (...a: unknown[]) => marcarLida(...a),
    marcarTodasLidas: (...a: unknown[]) => marcarTodasLidas(...a),
  },
  mensagemDeErroApi: (err: unknown, fallback: string) => {
    const status = (err as { status?: unknown } | null)?.status;
    const message = (err as { message?: unknown } | null)?.message;
    return typeof status === "number" && typeof message === "string" ? message : fallback;
  },
}));

const toastError = vi.fn();
vi.mock("sonner", () => ({ toast: { error: (...a: unknown[]) => toastError(...a) } }));

import NotificationBell from "./NotificationBell";

const notif = (over: Partial<Record<string, unknown>> = {}) => ({
  id: "notif-1",
  titulo: "Manutenção agendada",
  mensagem: "O site vai estar em baixo às 3h.",
  lida: false,
  created_at: "2026-01-01T00:00:00.000Z",
  ...over,
});

describe("NotificationBell", () => {
  beforeEach(() => {
    contarNaoLidas.mockReset().mockResolvedValue({ contagem: 0 });
    listarMinhas.mockReset();
    marcarLida.mockReset();
    marcarTodasLidas.mockReset();
    toastError.mockReset();
  });

  it("mostra o número de notificações por ler", async () => {
    contarNaoLidas.mockResolvedValue({ contagem: 3 });
    render(<NotificationBell claro={false} />);

    expect(await screen.findByText("3")).toBeInTheDocument();
  });

  it("não mostra nenhum número quando não há nada por ler", async () => {
    contarNaoLidas.mockResolvedValue({ contagem: 0 });
    render(<NotificationBell claro={false} />);

    await waitFor(() => expect(contarNaoLidas).toHaveBeenCalled());
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("ao abrir, carrega e mostra as notificações", async () => {
    contarNaoLidas.mockResolvedValue({ contagem: 1 });
    listarMinhas.mockResolvedValue([notif()]);
    const user = userEvent.setup();
    render(<NotificationBell claro={false} />);

    await user.click(await screen.findByRole("button", { name: /Notificações/i }));

    expect(await screen.findByText("Manutenção agendada")).toBeInTheDocument();
  });

  it("marcar uma como lida chama a API e actualiza a contagem sem esperar por outro pedido", async () => {
    contarNaoLidas.mockResolvedValue({ contagem: 1 });
    listarMinhas.mockResolvedValue([notif()]);
    marcarLida.mockResolvedValue(notif({ lida: true }));
    const user = userEvent.setup();
    render(<NotificationBell claro={false} />);

    await user.click(await screen.findByRole("button", { name: /Notificações/i }));
    await user.click(await screen.findByText("Manutenção agendada"));

    await waitFor(() => expect(marcarLida).toHaveBeenCalledWith("notif-1"));
    expect(screen.queryByText("1")).not.toBeInTheDocument();
  });

  it("nunca esconde uma falha ao marcar como lida", async () => {
    contarNaoLidas.mockResolvedValue({ contagem: 1 });
    listarMinhas.mockResolvedValue([notif()]);
    marcarLida.mockRejectedValue(Object.assign(new Error("falhou"), { status: 500 }));
    const user = userEvent.setup();
    render(<NotificationBell claro={false} />);

    await user.click(await screen.findByRole("button", { name: /Notificações/i }));
    await user.click(await screen.findByText("Manutenção agendada"));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("falhou"));
  });

  it("marcar tudo como lido zera a contagem", async () => {
    contarNaoLidas.mockResolvedValue({ contagem: 2 });
    listarMinhas.mockResolvedValue([notif(), notif({ id: "notif-2" })]);
    marcarTodasLidas.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<NotificationBell claro={false} />);

    await user.click(await screen.findByRole("button", { name: /Notificações/i }));
    await user.click(await screen.findByText("Marcar tudo como lido"));

    await waitFor(() => expect(marcarTodasLidas).toHaveBeenCalled());
    expect(screen.queryByText("2")).not.toBeInTheDocument();
  });
});
