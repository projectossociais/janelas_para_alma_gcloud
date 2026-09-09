import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const registar = vi.fn();
vi.mock("@/lib/apiClient", () => ({
  feedbackApi: { registar: (...a: unknown[]) => registar(...a) },
  mensagemDeErroApi: (err: unknown, fallback: string) => {
    const status = (err as { status?: unknown } | null)?.status;
    const message = (err as { message?: unknown } | null)?.message;
    return typeof status === "number" && typeof message === "string" ? message : fallback;
  },
}));

vi.mock("@/contexts/FeedbackContext", () => ({
  useFeedback: () => ({ isOpen: true, options: {}, openFeedback: vi.fn(), closeFeedback: vi.fn() }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a) },
}));

import FeedbackWidget from "./FeedbackWidget";

describe("FeedbackWidget", () => {
  beforeEach(() => {
    registar.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("exige uma classificação antes de enviar", async () => {
    const user = userEvent.setup();
    render(<FeedbackWidget />);

    await user.click(screen.getByRole("button", { name: /Enviar Resposta/i }));

    expect(registar).not.toHaveBeenCalled();
  });

  it("nunca mostra sucesso quando a API falha ao registar o feedback", async () => {
    registar.mockRejectedValue(Object.assign(new Error("falha ao gravar"), { status: 500 }));
    const user = userEvent.setup();
    render(<FeedbackWidget />);

    await user.click(screen.getByRole("button", { name: "5 estrelas" }));
    await user.click(screen.getByRole("button", { name: /Enviar Resposta/i }));

    await waitFor(() => expect(registar).toHaveBeenCalledWith(5, ""));
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("falha ao gravar");
    expect(screen.getByRole("button", { name: /Enviar Resposta/i })).toBeInTheDocument();
  });

  it("só mostra sucesso depois de a API confirmar o registo", async () => {
    registar.mockResolvedValue({ id: "f1", avaliacao: 5, comentario: null, created_at: "2026-01-01T00:00:00.000Z" });
    const user = userEvent.setup();
    render(<FeedbackWidget />);

    await user.click(screen.getByRole("button", { name: "5 estrelas" }));
    await user.click(screen.getByRole("button", { name: /Enviar Resposta/i }));

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Obrigado pelo seu feedback!"));
    expect(toastError).not.toHaveBeenCalled();
  });
});
