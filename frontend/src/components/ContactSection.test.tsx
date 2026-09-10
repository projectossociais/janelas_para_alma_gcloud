import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

// O formulário de contacto grava na API própria. O que importa testar é o
// caminho do erro: nunca mostrar "registada" quando a gravação falha
// (CLAUDE.md, "Nunca mostrar sucesso antes de verificar error/excepção").

const enviar = vi.fn();
vi.mock("@/lib/apiClient", () => ({
  contactMessagesApi: { enviar: (...a: unknown[]) => enviar(...a) },
  mensagemDeErroApi: (err: unknown, fallback: string) => {
    const status = (err as { status?: unknown } | null)?.status;
    const message = (err as { message?: unknown } | null)?.message;
    return typeof status === "number" && typeof message === "string" ? message : fallback;
  },
}));

// A candidatura a voluntário (mesmo componente) ainda usa a Edge Function —
// mockada para não sair pela rede.
vi.mock("@/lib/edgeFunction", () => ({ sendToEdgeFunction: vi.fn() }));
vi.mock("@/components/ProgramModal", () => ({ default: () => null }));

const toast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

import ContactSection from "./ContactSection";

async function abrirEPreencher(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /Envie-nos uma mensagem/i }));
  await user.type(await screen.findByPlaceholderText("O seu nome"), "Ana Silva");
  await user.type(screen.getByPlaceholderText("email@exemplo.com"), "ana@example.com");
  await user.type(screen.getByPlaceholderText("Como podemos ajudar?"), "Tenho uma dúvida sobre o rastreio.");
  await user.click(screen.getByRole("button", { name: /Enviar Mensagem/i }));
}

describe("ContactSection — formulário de contacto", () => {
  beforeEach(() => {
    enviar.mockReset();
    toast.mockReset();
  });

  it("nunca mostra sucesso quando a API falha ao gravar", async () => {
    enviar.mockRejectedValue(Object.assign(new Error("Serviço indisponível"), { status: 500 }));
    const user = userEvent.setup();
    render(<ContactSection />, { wrapper: MemoryRouter });

    await abrirEPreencher(user);

    await waitFor(() => expect(enviar).toHaveBeenCalledWith(
      "Ana Silva",
      "ana@example.com",
      "Tenho uma dúvida sobre o rastreio.",
    ));
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Erro ao enviar", variant: "destructive" }),
    );
    expect(toast).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringMatching(/registada/i) }),
    );
  });

  it("mostra sucesso só depois de a API confirmar a gravação", async () => {
    enviar.mockResolvedValue({ id: "msg-1" });
    const user = userEvent.setup();
    render(<ContactSection />, { wrapper: MemoryRouter });

    await abrirEPreencher(user);

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Mensagem registada!" })),
    );
  });
});
