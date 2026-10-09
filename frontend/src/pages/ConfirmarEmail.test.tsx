import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

class ApiErrorFalso extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const confirmarEmail = vi.fn();

vi.mock("@/lib/apiClient", () => ({
  authApi: {
    confirmarEmail: (token: string) => confirmarEmail(token),
  },
  mensagemDeErroApi: (err: unknown, fallback: string) => {
    const status = (err as { status?: unknown } | null)?.status;
    const message = (err as { message?: unknown } | null)?.message;
    return typeof status === "number" && typeof message === "string" ? message : fallback;
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ signIn: vi.fn(), registerUser: vi.fn() }),
}));

vi.mock("@/contexts/ProfileContext", () => ({
  useProfile: () => ({ profile: null, loading: false, refetch: vi.fn(), setProfile: vi.fn() }),
}));


import ConfirmarEmail from "./ConfirmarEmail";

function renderComToken(token: string | null) {
  const rota = token ? `/confirmar-email?token=${token}` : "/confirmar-email";
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <Routes>
        <Route path="/confirmar-email" element={<ConfirmarEmail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ConfirmarEmail", () => {
  beforeEach(() => {
    confirmarEmail.mockReset();
  });

  it("sem token na URL, mostra logo o erro sem chamar a API", async () => {
    renderComToken(null);

    expect(await screen.findByText("Este link de confirmação é inválido.")).toBeInTheDocument();
    expect(confirmarEmail).not.toHaveBeenCalled();
  });

  it("com token válido, confirma e mostra sucesso", async () => {
    confirmarEmail.mockResolvedValue(undefined);
    renderComToken("token-valido");

    await waitFor(() => expect(confirmarEmail).toHaveBeenCalledWith("token-valido"));
    expect(await screen.findByText("Conta confirmada!")).toBeInTheDocument();
    expect(screen.getByText("Já pode entrar com o seu email e palavra-passe.")).toBeInTheDocument();
  });

  it("nunca mostra sucesso quando o token é inválido ou expirou", async () => {
    confirmarEmail.mockRejectedValue(new ApiErrorFalso(400, "este link de confirmação é inválido ou expirou"));
    renderComToken("token-expirado");

    await waitFor(() => expect(confirmarEmail).toHaveBeenCalledWith("token-expirado"));
    expect(await screen.findByText("Não foi possível confirmar")).toBeInTheDocument();
    expect(screen.getByText("este link de confirmação é inválido ou expirou")).toBeInTheDocument();
    expect(screen.queryByText("Conta confirmada!")).not.toBeInTheDocument();
  });

  it("chama a API só uma vez mesmo que o componente monte duas vezes (StrictMode)", async () => {
    confirmarEmail.mockResolvedValue(undefined);
    renderComToken("token-valido");

    await waitFor(() => expect(confirmarEmail).toHaveBeenCalledTimes(1));
  });
});
