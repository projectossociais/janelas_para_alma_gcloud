import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";

class ApiErrorFalso extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const redefinirPassword = vi.fn();

vi.mock("@/lib/apiClient", () => ({
  authApi: {
    redefinirPassword: (token: string, senha: string) => redefinirPassword(token, senha),
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


const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...a: unknown[]) => toastError(...a), success: (...a: unknown[]) => toastSuccess(...a) },
}));

import AtualizarPassword from "./AtualizarPassword";

function renderComToken(token: string | null) {
  const rota = token ? `/atualizar-password?token=${token}` : "/atualizar-password";
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <Routes>
        <Route path="/atualizar-password" element={<AtualizarPassword />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function preencherEsubmeter(user: ReturnType<typeof userEvent.setup>, senha: string, confirmar: string) {
  await user.type(screen.getByLabelText("Nova Palavra-passe"), senha);
  await user.type(screen.getByLabelText("Confirmar Palavra-passe"), confirmar);
  await user.click(screen.getByRole("button", { name: /Guardar Nova Palavra-passe/ }));
}

describe("Actualizarpassword", () => {
  beforeEach(() => {
    redefinirPassword.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
  });

  it("sem token na URL, bloqueia o formulário em vez de deixar submeter", () => {
    renderComToken(null);

    expect(screen.getByText("Este link de recuperação é inválido.")).toBeInTheDocument();
    expect(screen.getByLabelText("Nova Palavra-passe")).toBeDisabled();
    expect(screen.getByLabelText("Confirmar Palavra-passe")).toBeDisabled();
    expect(screen.getByRole("button", { name: /Guardar Nova Palavra-passe/ })).toBeDisabled();
    expect(redefinirPassword).not.toHaveBeenCalled();
  });

  it("nunca mostra sucesso quando o token é inválido ou expirou", async () => {
    redefinirPassword.mockRejectedValue(new ApiErrorFalso(400, "este link de recuperação é inválido ou expirou"));
    const user = userEvent.setup();
    renderComToken("token-expirado");

    await preencherEsubmeter(user, "password-nova-123", "password-nova-123");

    await waitFor(() => expect(redefinirPassword).toHaveBeenCalledWith("token-expirado", "password-nova-123"));
    expect(toastError).toHaveBeenCalledWith("este link de recuperação é inválido ou expirou");
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("só mostra sucesso depois de a API confirmar a mudança", async () => {
    redefinirPassword.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderComToken("token-valido");

    await preencherEsubmeter(user, "password-nova-123", "password-nova-123");

    await waitFor(() => expect(redefinirPassword).toHaveBeenCalledWith("token-valido", "password-nova-123"));
    expect(toastError).not.toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalledWith("Palavra-passe actualizada com sucesso!");
  });

  it("recusa quando as palavras-passe não coincidem, sem chamar a API", async () => {
    const user = userEvent.setup();
    renderComToken("token-valido");

    await preencherEsubmeter(user, "password-nova-123", "outra-coisa-456");

    expect(redefinirPassword).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("As palavras-passe não coincidem.");
  });

  it("recusa uma palavra-passe curta demais, sem chamar a API", async () => {
    const user = userEvent.setup();
    renderComToken("token-valido");

    await preencherEsubmeter(user, "curta", "curta");

    expect(redefinirPassword).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("A palavra-passe deve ter pelo menos 8 caracteres.");
  });
});
