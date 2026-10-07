import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { violacoesAcessibilidade } from "@/design/testes/acessibilidade";

// --- mocks: isolamos Auth.tsx da API real e do resto da app ---
// Login/registo passam pelo AuthContext, já coberto nos testes desse contexto.

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
  useAuth: () => ({
    signIn: (...a: unknown[]) => signIn(...a),
    registerUser: (...a: unknown[]) => registerUser(...a),
    signInWithGoogle: vi.fn(),
  }),
  PROVINCES: ["Luanda", "Huambo"],
  ROLE_LABEL: { comum: "Comum", estrabico: "Estrábico", profissional: "Profissional" },
}));

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...a: unknown[]) => toastError(...a), success: (...a: unknown[]) => toastSuccess(...a) },
}));

import Auth from "./Auth";

const montar = (url = "/login") =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Auth />
    </MemoryRouter>,
  );

describe("Auth — esqueceu a palavra-passe", () => {
  beforeEach(() => {
    recuperarPassword.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
  });

  it("exige o email antes de pedir a recuperação", async () => {
    const user = userEvent.setup();
    montar();

    await user.click(screen.getByText("Esqueceu a palavra-passe?"));

    expect(recuperarPassword).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("Escreva o seu email no campo acima primeiro.");
  });

  it("nunca mostra sucesso quando o pedido falha de verdade", async () => {
    recuperarPassword.mockRejectedValue(new ApiErrorFalso(500, "Resend indisponível"));
    const user = userEvent.setup();
    montar();

    await user.type(screen.getByLabelText("Email"), "ana@example.com");
    await user.click(screen.getByText("Esqueceu a palavra-passe?"));

    await waitFor(() => expect(recuperarPassword).toHaveBeenCalledWith("ana@example.com"));
    expect(toastError).toHaveBeenCalledWith("Resend indisponível");
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("mostra a mensagem genérica de sucesso depois de a API aceitar o pedido", async () => {
    recuperarPassword.mockResolvedValue({ mensagem: "ok" });
    const user = userEvent.setup();
    montar();

    await user.type(screen.getByLabelText("Email"), "ana@example.com");
    await user.click(screen.getByText("Esqueceu a palavra-passe?"));

    await waitFor(() => expect(recuperarPassword).toHaveBeenCalledWith("ana@example.com"));
    expect(toastError).not.toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalledWith(
      "Se existir uma conta com este email, foi enviado um link de recuperação.",
    );
  });
});

describe("Auth — entrar (AUTH-02)", () => {
  beforeEach(() => {
    signIn.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
  });

  const entrar = async (user: ReturnType<typeof userEvent.setup>, password = "password-forte-123") => {
    await user.type(screen.getByLabelText("Email"), "ana@example.com");
    await user.type(screen.getByLabelText("Palavra-passe"), password);
    const formulario = screen.getByLabelText("Palavra-passe").closest("form")!;
    await user.click(within(formulario).getByRole("button", { name: /Entrar/ }));
  };

  it("oferece reenviar o link quando o login falha por email não confirmado", async () => {
    signIn.mockResolvedValue({ ok: false, error: "confirme o seu email antes de entrar" });
    const user = userEvent.setup();
    montar();

    await entrar(user);

    await waitFor(() => expect(signIn).toHaveBeenCalledWith("ana@example.com", "password-forte-123"));
    expect(toastError).toHaveBeenCalledWith(
      "confirme o seu email antes de entrar",
      expect.objectContaining({ action: expect.objectContaining({ label: "Reenviar link" }) }),
    );
  });

  it("mostra o erro genérico quando as credenciais estão erradas", async () => {
    signIn.mockResolvedValue({ ok: false, error: "email ou password incorrectos" });
    const user = userEvent.setup();
    montar();

    await entrar(user, "errada");

    await waitFor(() => expect(signIn).toHaveBeenCalled());
    expect(toastError).toHaveBeenCalledWith("email ou password incorrectos");
  });

  it("sem email nem password, diz o que falta e não chama a API", async () => {
    const user = userEvent.setup();
    montar();

    const formulario = screen.getByLabelText("Palavra-passe").closest("form")!;
    await user.click(within(formulario).getByRole("button", { name: /Entrar/ }));

    // O erro fica no próprio campo, e o foco vai para o primeiro por corrigir.
    expect(await screen.findByText("Escreva o email completo, por exemplo nome@gmail.com.")).toBeInTheDocument();
    expect(screen.getByText("Escreva a palavra-passe.")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    await waitFor(() => expect(screen.getByLabelText("Email")).toHaveFocus());
    expect(signIn).not.toHaveBeenCalled();
  });

  it("não há caixa de resumo de erros por cima do formulário", async () => {
    const user = userEvent.setup();
    montar();
    const formulario = screen.getByLabelText("Palavra-passe").closest("form")!;
    await user.click(within(formulario).getByRole("button", { name: /Entrar/ }));
    await screen.findByText("Escreva a palavra-passe.");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(/Corrija o que falta/)).not.toBeInTheDocument();
  });

  it("não mostra erros enquanto se escreve pela primeira vez", async () => {
    const user = userEvent.setup();
    montar();
    await user.type(screen.getByLabelText("Email"), "ana");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("'Mostrar' deixa ver a palavra-passe escrita", async () => {
    const user = userEvent.setup();
    montar();
    const campo = screen.getByLabelText("Palavra-passe");
    await user.type(campo, "segredo123");
    expect(campo).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: /Mostrar/ }));
    expect(campo).toHaveAttribute("type", "text");
  });

  it("?modo=registo abre directamente em criar conta", () => {
    montar("/login?modo=registo");
    expect(screen.getByRole("heading", { level: 1, name: "Criar a sua conta" })).toBeInTheDocument();
  });

  it("sem violações de acessibilidade, a entrar e a criar conta", async () => {
    const user = userEvent.setup();
    const { container } = montar();
    expect(await violacoesAcessibilidade(container)).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Criar Conta" }));
    await screen.findByLabelText("Nome Completo");
    expect(await violacoesAcessibilidade(container)).toEqual([]);
  });
});

describe("Auth — criar conta (AUTH-02)", () => {
  beforeEach(() => {
    registerUser.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
  });

  async function irParaCriarEPreencher(
    user: ReturnType<typeof userEvent.setup>,
    overrides: { password?: string } = {},
  ) {
    await user.click(screen.getByRole("button", { name: "Criar Conta" }));

    // A troca de modo é animada: o formulário novo aparece logo a seguir.
    await user.type(await screen.findByLabelText("Nome Completo"), "Ana Teste");
    await user.type(screen.getByLabelText("Email"), "ana@example.com");
    await user.type(screen.getByLabelText("Palavra-passe"), overrides.password ?? "password-forte-123");
    await user.selectOptions(screen.getByLabelText("Província"), "Luanda");
    await user.click(screen.getByRole("radio", { name: "Feminino" }));
    await user.click(screen.getByRole("radio", { name: "Comum" }));

    await user.click(screen.getByRole("button", { name: "Criar Conta" }));
  }

  it("recusa uma password fraca, sem chamar a API, e diz porquê", async () => {
    const user = userEvent.setup();
    montar();

    await irParaCriarEPreencher(user, { password: "12345678" });

    expect(registerUser).not.toHaveBeenCalled();
    expect(await screen.findByText("A palavra-passe precisa de pelo menos uma letra.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Palavra-passe")).toHaveFocus());
  });

  it("sem preencher nada, cada campo diz o que falta e o foco vai para o primeiro", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("button", { name: "Criar Conta" }));
    await screen.findByLabelText("Nome Completo");
    await user.click(screen.getByRole("button", { name: "Criar Conta" }));

    for (const texto of [
      "Escreva o seu nome.",
      "Escreva o email completo, por exemplo nome@gmail.com.",
      "Escreva a palavra-passe.",
      "Escolha a sua província.",
      "Escolha uma opção de género.",
      "Escolha o seu perfil.",
    ]) {
      expect(await screen.findByText(texto)).toBeInTheDocument();
    }
    expect(registerUser).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByLabelText("Nome Completo")).toHaveFocus());
  });

  it("se só o perfil falta, o foco vai para o grupo de perfil", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("button", { name: "Criar Conta" }));
    await user.type(await screen.findByLabelText("Nome Completo"), "Ana");
    await user.type(screen.getByLabelText("Email"), "ana@example.com");
    await user.type(screen.getByLabelText("Palavra-passe"), "password-forte-123");
    await user.selectOptions(screen.getByLabelText("Província"), "Luanda");
    await user.click(screen.getByRole("radio", { name: "Feminino" }));
    await user.click(screen.getByRole("button", { name: "Criar Conta" }));

    expect(await screen.findByText("Escolha o seu perfil.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("radio", { name: "Comum" })).toHaveFocus());
    expect(registerUser).not.toHaveBeenCalled();
  });

  it("depois da primeira tentativa, o erro desaparece assim que o campo é corrigido", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("button", { name: "Criar Conta" }));
    await screen.findByLabelText("Nome Completo");
    await user.click(screen.getByRole("button", { name: "Criar Conta" }));
    expect(await screen.findByText("Escreva o seu nome.")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Nome Completo"), "Ana");

    await waitFor(() => expect(screen.queryByText("Escreva o seu nome.")).not.toBeInTheDocument());
  });

  it("envia só o que a API precisa, sem confirmação de password", async () => {
    registerUser.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    montar();

    await irParaCriarEPreencher(user);

    await waitFor(() => expect(registerUser).toHaveBeenCalled());
    expect(registerUser).toHaveBeenCalledWith({
      name: "Ana Teste",
      email: "ana@example.com",
      password: "password-forte-123",
      province: "Luanda",
      gender: "feminino",
      role: "comum",
    });
  });

  it("depois de criar a conta, nunca navega como se estivesse autenticado: muda para entrar", async () => {
    registerUser.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    montar();

    await irParaCriarEPreencher(user);

    await waitFor(() => expect(registerUser).toHaveBeenCalled());
    expect(toastSuccess).toHaveBeenCalledWith(
      expect.stringContaining("Enviámos um link de confirmação"),
      expect.anything(),
    );
    // Voltou a "Entrar": o campo de nome já não está no ecrã.
    await waitFor(() => expect(screen.queryByLabelText("Nome Completo")).not.toBeInTheDocument());
    // O email fica preenchido para o próximo passo óbvio ser só a password.
    expect(screen.getByLabelText("Email")).toHaveValue("ana@example.com");
    // E a password não fica no ecrã.
    expect(screen.getByLabelText("Palavra-passe")).toHaveValue("");
  });

  it("nunca muda de modo quando a API recusa o registo", async () => {
    registerUser.mockResolvedValue({ ok: false, error: "o email já está registado" });
    const user = userEvent.setup();
    montar();

    await irParaCriarEPreencher(user);

    await waitFor(() => expect(registerUser).toHaveBeenCalled());
    expect(toastError).toHaveBeenCalledWith("o email já está registado");
    expect(toastSuccess).not.toHaveBeenCalled();
    // continua a criar conta: o campo de nome ainda está no ecrã
    expect(screen.getByLabelText("Nome Completo")).toBeInTheDocument();
  });

  it("avisa que as contas são para maiores de 18 anos", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("button", { name: "Criar Conta" }));
    expect(await screen.findByText(/maiores de 18 anos/)).toBeInTheDocument();
  });
});
