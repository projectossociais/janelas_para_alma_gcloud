import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import AtualizarPassword from "./AtualizarPassword";

// Decide acesso à conta -- exige teste (CLAUDE.md secção 8). O caminho do
// erro (token inválido/expirado) pesa tanto como o do sucesso.

const redefinirPassword = vi.fn();
vi.mock("@/lib/apiClient", () => ({
  authApi: { redefinirPassword: (t: string, p: string) => redefinirPassword(t, p) },
  mensagemDeErroApi: (err: unknown, fallback: string) => {
    const status = (err as { status?: unknown } | null)?.status;
    const message = (err as { message?: unknown } | null)?.message;
    return typeof status === "number" && typeof message === "string" ? message : fallback;
  },
}));

vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...a: unknown[]) => toastError(...a),
    success: (...a: unknown[]) => toastSuccess(...a),
  },
}));

const renderPagina = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AtualizarPassword />
    </MemoryRouter>
  );

beforeEach(() => {
  redefinirPassword.mockReset();
  toastError.mockReset();
  toastSuccess.mockReset();
});

describe("AtualizarPassword", () => {
  it("sem token na URL, mostra o link inválido e nunca mostra o formulário", () => {
    renderPagina("/atualizar-password");

    expect(screen.getByText(/link inválido/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/nova palavra-passe/i)).not.toBeInTheDocument();
  });

  it("token válido: redefine e volta ao login", async () => {
    redefinirPassword.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPagina("/atualizar-password?token=abc123");

    await user.type(screen.getByLabelText("Nova Palavra-passe"), "nova-password-123");
    await user.type(screen.getByLabelText("Confirmar Palavra-passe"), "nova-password-123");
    await user.click(screen.getByRole("button", { name: /guardar nova palavra-passe/i }));

    await waitFor(() =>
      expect(redefinirPassword).toHaveBeenCalledWith("abc123", "nova-password-123")
    );
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("nunca chama a API se as palavras-passe não coincidirem", async () => {
    const user = userEvent.setup();
    renderPagina("/atualizar-password?token=abc123");

    await user.type(screen.getByLabelText("Nova Palavra-passe"), "password-123");
    await user.type(screen.getByLabelText("Confirmar Palavra-passe"), "outra-password-456");
    await user.click(screen.getByRole("button", { name: /guardar nova palavra-passe/i }));

    expect(redefinirPassword).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalled();
  });

  it("token expirado/inválido: nunca finge sucesso", async () => {
    redefinirPassword.mockRejectedValue({ status: 410, message: "token expirado" });
    const user = userEvent.setup();
    renderPagina("/atualizar-password?token=expirado");

    await user.type(screen.getByLabelText("Nova Palavra-passe"), "nova-password-123");
    await user.type(screen.getByLabelText("Confirmar Palavra-passe"), "nova-password-123");
    await user.click(screen.getByRole("button", { name: /guardar nova palavra-passe/i }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("token expirado"));
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
