import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

// --- mocks: isolamos Auth.tsx da API real e do resto da app ---
// Só testamos aqui o fluxo "Esqueceu a palavra-passe?" -- login/registo
// passam pelo AuthContext, já coberto nos testes desse contexto.

class ApiErrorFalso extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const recuperarPassword = vi.fn();

vi.mock("@/lib/apiClient", () => ({
  authApi: {
    recuperarPassword: (email: string) => recuperarPassword(email),
  },
  mensagemDeErroApi: (err: unknown, fallback: string) => {
    const status = (err as { status?: unknown } | null)?.status;
    const message = (err as { message?: unknown } | null)?.message;
    return typeof status === "number" && typeof message === "string" ? message : fallback;
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ signIn: vi.fn(), registerUser: vi.fn() }),
  PROVINCES: ["Luanda"],
  ROLE_LABEL: { comum: "Comum", estrabico: "Estrábico", profissional: "Profissional" },
}));

vi.mock("@/contexts/ProfileContext", () => ({
  useProfile: () => ({ profile: null, loading: false, refetch: vi.fn(), setProfile: vi.fn() }),
}));

vi.mock("@/hooks/useSupabaseRole", () => ({
  useSupabaseRole: () => ({ isAdmin: false }),
}));

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...a: unknown[]) => toastError(...a), success: (...a: unknown[]) => toastSuccess(...a) },
}));

import Auth from "./Auth";

describe("Auth — esqueceu a palavra-passe", () => {
  beforeEach(() => {
    recuperarPassword.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
  });

  it("exige o email antes de pedir a recuperação", async () => {
    const user = userEvent.setup();
    render(<Auth />, { wrapper: MemoryRouter });

    await user.click(screen.getByText("Esqueceu a palavra-passe?"));

    expect(recuperarPassword).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("Escreva o seu email no campo acima primeiro.");
  });

  it("nunca mostra sucesso quando o pedido falha de verdade", async () => {
    recuperarPassword.mockRejectedValue(new ApiErrorFalso(500, "Resend indisponível"));
    const user = userEvent.setup();
    render(<Auth />, { wrapper: MemoryRouter });

    await user.type(screen.getByLabelText("Email"), "ana@example.com");
    await user.click(screen.getByText("Esqueceu a palavra-passe?"));

    await waitFor(() => expect(recuperarPassword).toHaveBeenCalledWith("ana@example.com"));
    expect(toastError).toHaveBeenCalledWith("Resend indisponível");
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("mostra a mensagem genérica de sucesso depois de a API aceitar o pedido", async () => {
    recuperarPassword.mockResolvedValue({ mensagem: "ok" });
    const user = userEvent.setup();
    render(<Auth />, { wrapper: MemoryRouter });

    await user.type(screen.getByLabelText("Email"), "ana@example.com");
    await user.click(screen.getByText("Esqueceu a palavra-passe?"));

    await waitFor(() => expect(recuperarPassword).toHaveBeenCalledWith("ana@example.com"));
    expect(toastError).not.toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalledWith(
      "Se existir uma conta com este email, foi enviado um link de recuperação.",
    );
  });
});
