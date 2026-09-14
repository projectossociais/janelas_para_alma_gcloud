import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
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
const reenviarConfirmacao = vi.fn();

vi.mock("@/lib/apiClient", () => ({
  authApi: {
    recuperarPassword: (email: string) => recuperarPassword(email),
    reenviarConfirmacao: (email: string) => reenviarConfirmacao(email),
  },
  mensagemDeErroApi: (err: unknown, fallback: string) => {
    const status = (err as { status?: unknown } | null)?.status;
    const message = (err as { message?: unknown } | null)?.message;
    return typeof status === "number" && typeof message === "string" ? message : fallback;
  },
}));

const signIn = vi.fn();
const registerUser = vi.fn();

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ signIn: (...a: unknown[]) => signIn(...a), registerUser: (...a: unknown[]) => registerUser(...a) }),
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

describe("Auth — login (AUTH-02)", () => {
  beforeEach(() => {
    signIn.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
  });

  it("oferece reenviar o link quando o login falha por email não confirmado", async () => {
    signIn.mockResolvedValue({ ok: false, error: "confirme o seu email antes de entrar" });
    const user = userEvent.setup();
    render(<Auth />, { wrapper: MemoryRouter });

    await user.type(screen.getByLabelText("Email"), "ana@example.com");
    await user.type(screen.getByLabelText("Palavra-passe"), "password-forte-123");
    // "Entrar" também existe na Navbar -- restringe ao formulário de login.
    const formularioLogin = screen.getByLabelText("Palavra-passe").closest("form")!;
    await user.click(within(formularioLogin).getByRole("button", { name: /Entrar/ }));

    await waitFor(() => expect(signIn).toHaveBeenCalledWith("ana@example.com", "password-forte-123"));
    expect(toastError).toHaveBeenCalledWith(
      "confirme o seu email antes de entrar",
      expect.objectContaining({ action: expect.objectContaining({ label: "Reenviar link" }) }),
    );
  });

  it("mostra o erro genérico quando as credenciais estão erradas", async () => {
    signIn.mockResolvedValue({ ok: false, error: "email ou password incorretos" });
    const user = userEvent.setup();
    render(<Auth />, { wrapper: MemoryRouter });

    await user.type(screen.getByLabelText("Email"), "ana@example.com");
    await user.type(screen.getByLabelText("Palavra-passe"), "errada");
    const formularioLogin = screen.getByLabelText("Palavra-passe").closest("form")!;
    await user.click(within(formularioLogin).getByRole("button", { name: /Entrar/ }));

    await waitFor(() => expect(signIn).toHaveBeenCalled());
    expect(toastError).toHaveBeenCalledWith("email ou password incorretos");
  });
});

describe("Auth — registo (AUTH-02)", () => {
  beforeEach(() => {
    registerUser.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
  });

  async function irParaRegistoEPreencher(
    user: ReturnType<typeof userEvent.setup>,
    overrides: { password?: string; confirmar?: string } = {},
  ) {
    await user.click(screen.getByRole("tab", { name: "Criar Conta" }));

    await user.type(screen.getByLabelText("Nome Completo"), "Ana Teste");
    await user.type(screen.getByLabelText("Email"), "ana@example.com");
    await user.type(screen.getByLabelText("Palavra-passe"), overrides.password ?? "password-forte-123");
    await user.type(
      screen.getByLabelText("Confirmar Palavra-passe"),
      overrides.confirmar ?? overrides.password ?? "password-forte-123",
    );

    // Os <Select> aqui não têm <Label htmlFor>, por isso não dá para
    // procurar por accessible name -- abre-se cada um pelo botão que
    // envolve o texto do placeholder (o próprio span do Radix tem
    // pointer-events:none de propósito, para o clique "passar" ao botão).
    await user.click(screen.getByText("Selecione a sua província").closest("button")!);
    await user.click(screen.getByRole("option", { name: "Luanda" }));

    await user.click(screen.getByText("Selecione o seu género").closest("button")!);
    await user.click(screen.getByRole("option", { name: "Feminino" }));

    await user.click(screen.getByText("Selecione o seu perfil").closest("button")!);
    await user.click(screen.getByRole("option", { name: "Comum" }));

    await user.click(screen.getByRole("button", { name: /Criar Conta/ }));
  }

  it("recusa quando as palavras-passe não coincidem, sem chamar a API", async () => {
    const user = userEvent.setup();
    render(<Auth />, { wrapper: MemoryRouter });

    await irParaRegistoEPreencher(user, { password: "password-forte-123", confirmar: "outra-coisa-456" });

    expect(registerUser).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("As palavras-passe não coincidem.");
  });

  it("recusa uma password fraca, sem chamar a API", async () => {
    const user = userEvent.setup();
    render(<Auth />, { wrapper: MemoryRouter });

    await irParaRegistoEPreencher(user, { password: "12345678", confirmar: "12345678" });

    expect(registerUser).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("A palavra-passe precisa de pelo menos uma letra.");
  });

  it("depois de criar a conta, nunca navega como se estivesse autenticado -- muda para o login", async () => {
    registerUser.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<Auth />, { wrapper: MemoryRouter });

    await irParaRegistoEPreencher(user);

    await waitFor(() => expect(registerUser).toHaveBeenCalled());
    expect(toastSuccess).toHaveBeenCalledWith(
      expect.stringContaining("Enviámos um link de confirmação"),
      expect.anything(),
    );
    // Voltou para o separador de login (o campo de nome do registo já não está no ecrã).
    await waitFor(() => expect(screen.queryByLabelText("Nome Completo")).not.toBeInTheDocument());
    // E o email fica pré-preenchido no login, para o próximo passo óbvio ser só a password.
    expect(screen.getByLabelText("Email")).toHaveValue("ana@example.com");
  });

  it("nunca muda de separador quando a API recusa o registo", async () => {
    registerUser.mockResolvedValue({ ok: false, error: "o email já está registado" });
    const user = userEvent.setup();
    render(<Auth />, { wrapper: MemoryRouter });

    await irParaRegistoEPreencher(user);

    await waitFor(() => expect(registerUser).toHaveBeenCalled());
    expect(toastError).toHaveBeenCalledWith("o email já está registado");
    expect(toastSuccess).not.toHaveBeenCalled();
    // continua no registo -- o campo de nome ainda está no ecrã
    expect(screen.getByLabelText("Nome Completo")).toBeInTheDocument();
  });
});
