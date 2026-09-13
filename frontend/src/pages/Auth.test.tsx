import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Auth from "./Auth";

// O que importa testar aqui é a recuperação de password (lógica que só
// existe nesta página, não em AuthContext): a mensagem nunca pode distinguir
// um email que existe de um que não existe, e nunca finge sucesso quando o
// pedido falha (CLAUDE.md, "nunca mostrar sucesso antes de verificar erro").

const solicitarRecuperacaoPassword = vi.fn();
vi.mock("@/lib/apiClient", () => ({
  authApi: {
    solicitarRecuperacaoPassword: (email: string) => solicitarRecuperacaoPassword(email),
  },
  mensagemDeErroApi: (err: unknown, fallback: string) => {
    const status = (err as { status?: unknown } | null)?.status;
    const message = (err as { message?: unknown } | null)?.message;
    return typeof status === "number" && typeof message === "string" ? message : fallback;
  },
}));

const signIn = vi.fn();
const signInWithGoogle = vi.fn();
const registerUser = vi.fn();
vi.mock("@/contexts/AuthContext", async () => {
  // PROVINCES/UserRole/ROLE_LABEL são usados pelo separador de registo desta
  // página -- preservados do módulo real, só `useAuth` é substituído.
  const real = await vi.importActual<typeof import("@/contexts/AuthContext")>(
    "@/contexts/AuthContext"
  );
  return {
    ...real,
    useAuth: () => ({ signIn, signInWithGoogle, registerUser }),
  };
});

vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));
vi.mock("@/components/GoogleSignInButton", () => ({ default: () => null }));

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...a: unknown[]) => toastError(...a),
    success: (...a: unknown[]) => toastSuccess(...a),
    info: vi.fn(),
  },
}));

const renderPagina = () =>
  render(
    <MemoryRouter>
      <Auth />
    </MemoryRouter>
  );

beforeEach(() => {
  solicitarRecuperacaoPassword.mockReset();
  toastError.mockReset();
  toastSuccess.mockReset();
});

describe("Auth — recuperação de password", () => {
  it("pede o email e mostra sempre a mesma mensagem de sucesso", async () => {
    solicitarRecuperacaoPassword.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPagina();

    await user.click(screen.getByText("Esqueceu a palavra-passe?"));
    await user.type(screen.getByLabelText("Email"), "ana@example.com");
    await user.click(screen.getByRole("button", { name: /enviar link de recuperação/i }));

    await waitFor(() =>
      expect(solicitarRecuperacaoPassword).toHaveBeenCalledWith("ana@example.com")
    );
    expect(toastSuccess).toHaveBeenCalledWith(expect.stringContaining("Se esse email"));
    // Volta ao login depois de enviar.
    expect(screen.getByRole("button", { name: /^entrar/i })).toBeInTheDocument();
  });

  it("nunca finge sucesso quando o pedido falha", async () => {
    solicitarRecuperacaoPassword.mockRejectedValue({ status: 500, message: "falha simulada" });
    const user = userEvent.setup();
    renderPagina();

    await user.click(screen.getByText("Esqueceu a palavra-passe?"));
    await user.type(screen.getByLabelText("Email"), "ana@example.com");
    await user.click(screen.getByRole("button", { name: /enviar link de recuperação/i }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("falha simulada"));
    expect(toastSuccess).not.toHaveBeenCalled();
    // Continua no formulário de recuperação -- não finge que já foi.
    expect(screen.getByRole("button", { name: /enviar link de recuperação/i })).toBeInTheDocument();
  });

  it("nunca chama a API sem um email preenchido", async () => {
    const user = userEvent.setup();
    renderPagina();

    await user.click(screen.getByText("Esqueceu a palavra-passe?"));
    await user.click(screen.getByRole("button", { name: /enviar link de recuperação/i }));

    expect(solicitarRecuperacaoPassword).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalled();
  });
});
