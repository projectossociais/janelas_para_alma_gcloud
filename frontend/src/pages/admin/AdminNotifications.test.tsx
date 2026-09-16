import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// O que importa aqui é o caminho do erro: enviar é um fluxo que grava
// dados (uma notificação por destinatário), nunca pode mostrar sucesso
// quando a API falha.

const enviar = vi.fn();
vi.mock("@/lib/apiClient", () => ({
  notificacoesApi: { enviar: (...a: unknown[]) => enviar(...a) },
  PAPEIS_PARA_NOTIFICAR: ["comum", "estrabico", "profissional", "oftalmologista", "voluntario", "admin"],
  mensagemDeErroApi: (err: unknown, fallback: string) => {
    const status = (err as { status?: unknown } | null)?.status;
    const message = (err as { message?: unknown } | null)?.message;
    return typeof status === "number" && typeof message === "string" ? message : fallback;
  },
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a) },
}));

import AdminNotifications from "./AdminNotifications";

async function preencherEEnviar(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Título"), "Manutenção");
  await user.type(screen.getByLabelText("Mensagem"), "O site vai estar em baixo.");
  await user.click(screen.getByRole("button", { name: /Enviar/i }));
}

describe("AdminNotifications", () => {
  beforeEach(() => {
    enviar.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("nunca mostra sucesso quando a API falha ao enviar", async () => {
    enviar.mockRejectedValue(Object.assign(new Error("sem permissões"), { status: 403 }));
    const user = userEvent.setup();
    render(<AdminNotifications />);

    await preencherEEnviar(user);

    await waitFor(() => expect(enviar).toHaveBeenCalledWith("Manutenção", "O site vai estar em baixo.", null));
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("sem permissões");
  });

  it("mostra sucesso com a contagem real de destinatários", async () => {
    enviar.mockResolvedValue({ enviadas: 5 });
    const user = userEvent.setup();
    render(<AdminNotifications />);

    await preencherEEnviar(user);

    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith(expect.stringMatching(/5 pessoas/i)),
    );
    expect(await screen.findByText("Manutenção")).toBeInTheDocument();
  });

  it("avisa quando ninguém tem o perfil escolhido, sem fingir sucesso enganoso", async () => {
    enviar.mockResolvedValue({ enviadas: 0 });
    const user = userEvent.setup();
    render(<AdminNotifications />);

    await preencherEEnviar(user);

    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith(expect.stringMatching(/não há ninguém/i)),
    );
  });
});
