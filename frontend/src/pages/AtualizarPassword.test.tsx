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
const recuperarPassword = vi.fn();

vi.mock("@/lib/apiClient", () => ({
  authApi: {
    redefinirPassword: (token: string, senha: string) => redefinirPassword(token, senha),
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
import { violacoesAcessibilidade } from "@/design/testes/acessibilidade";

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
    recuperarPassword.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
  });

  it("sem token na URL: diz que o link é inválido, não mostra o formulário e deixa pedir outro", () => {
    renderComToken(null);

    expect(screen.getByRole("alert")).toHaveTextContent("Este link de recuperação é inválido.");
    expect(screen.queryByLabelText("Nova Palavra-passe")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar novo link" })).toBeInTheDocument();
    expect(redefinirPassword).not.toHaveBeenCalled();
  });

  // Antes: um beco sem saída -- a página dizia que o link não servia e mais nada.
  it("pedir um novo link chama a API e confirma de forma neutra (não revela se a conta existe)", async () => {
    recuperarPassword.mockResolvedValue({ mensagem: "ok" });
    const user = userEvent.setup();
    renderComToken(null);

    await user.type(screen.getByLabelText("Email da conta"), "ana@example.com");
    await user.click(screen.getByRole("button", { name: "Enviar novo link" }));

    await waitFor(() => expect(recuperarPassword).toHaveBeenCalledWith("ana@example.com"));
    expect(await screen.findByText(/Se houver uma conta com esse email, enviámos um novo link/)).toBeInTheDocument();
  });

  it("nunca mostra sucesso quando o token é inválido ou expirou", async () => {
    redefinirPassword.mockRejectedValue(new ApiErrorFalso(400, "este link de recuperação é inválido ou expirou"));
    const user = userEvent.setup();
    renderComToken("token-expirado");

    await preencherEsubmeter(user, "password-nova-123", "password-nova-123");

    await waitFor(() => expect(redefinirPassword).toHaveBeenCalledWith("token-expirado", "password-nova-123"));
    expect(await screen.findByRole("alert")).toHaveTextContent("este link de recuperação é inválido ou expirou");
    expect(screen.getByRole("button", { name: "Enviar novo link" })).toBeInTheDocument();
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
    // O erro fica no campo, não num aviso que desaparece.
    expect(screen.getByText("As palavras-passe não coincidem.")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirmar Palavra-passe")).toHaveAttribute("aria-invalid", "true");
  });

  it("recusa uma palavra-passe curta demais, sem chamar a API", async () => {
    const user = userEvent.setup();
    renderComToken("token-valido");

    await preencherEsubmeter(user, "curta", "curta");

    expect(redefinirPassword).not.toHaveBeenCalled();
    expect(screen.getByText("A palavra-passe deve ter pelo menos 8 caracteres.")).toBeInTheDocument();
  });

  it("sem violações de acessibilidade", async () => {
    const { container } = renderComToken("token-valido");
    expect(await violacoesAcessibilidade(container)).toEqual([]);
  });
});
