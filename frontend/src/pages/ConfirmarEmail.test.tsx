import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ConfirmarEmail from "./ConfirmarEmail";

const confirmarEmail = vi.fn();
vi.mock("@/lib/apiClient", () => ({
  authApi: { confirmarEmail: (t: string) => confirmarEmail(t) },
  mensagemDeErroApi: (err: unknown, fallback: string) => {
    const status = (err as { status?: unknown } | null)?.status;
    const message = (err as { message?: unknown } | null)?.message;
    return typeof status === "number" && typeof message === "string" ? message : fallback;
  },
}));

vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));

const renderPagina = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ConfirmarEmail />
    </MemoryRouter>
  );

beforeEach(() => {
  confirmarEmail.mockReset();
});

describe("ConfirmarEmail", () => {
  it("sem token, mostra erro sem chamar a API", () => {
    renderPagina("/confirmar-email");

    expect(confirmarEmail).not.toHaveBeenCalled();
    expect(screen.getByText(/não foi possível confirmar/i)).toBeInTheDocument();
  });

  it("token válido: confirma e mostra sucesso", async () => {
    confirmarEmail.mockResolvedValue(undefined);
    renderPagina("/confirmar-email?token=abc123");

    expect(await screen.findByText(/conta confirmada/i)).toBeInTheDocument();
    expect(confirmarEmail).toHaveBeenCalledWith("abc123");
  });

  it("token inválido/expirado: nunca finge sucesso", async () => {
    confirmarEmail.mockRejectedValue({ status: 410, message: "token expirado" });
    renderPagina("/confirmar-email?token=expirado");

    expect(await screen.findByText("token expirado")).toBeInTheDocument();
    expect(screen.queryByText(/conta confirmada/i)).not.toBeInTheDocument();
  });
});
