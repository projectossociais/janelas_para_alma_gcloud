import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

// --- mocks: isolamos Configuracoes.tsx da API real e do resto da app ---

class ApiErrorFalso extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const mudarPassword = vi.fn();
const eliminar = vi.fn();
const atualizarPerfil = vi.fn();

// mensagemDeErroApi é duck-typing puro (propriedade `status`) -- não precisa
// de ApiError real nem mockado para funcionar correctamente aqui.
vi.mock("@/lib/apiClient", () => ({
  contaApi: {
    mudarPassword: (a: string, b: string) => mudarPassword(a, b),
    eliminar: () => eliminar(),
  },
  perfilApi: {
    atualizar: (dados: unknown) => atualizarPerfil(dados),
  },
  mensagemDeErroApi: (err: unknown, fallback: string) => {
    const status = (err as { status?: unknown } | null)?.status;
    const message = (err as { message?: unknown } | null)?.message;
    return typeof status === "number" && typeof message === "string" ? message : fallback;
  },
}));


const mockProfile = {
  id: "user-1",
  nome_completo: "Ana Teste",
  email: "ana@example.com",
  biografia: null,
  data_nascimento: null,
  genero: null,
  telefone: null,
  provincia: null,
  avatar_url: null,
  papel: "comum",
  notificacoes_projetos: false,
  notificacoes_lembretes: false,
  notificacoes_comunidade: false,
  created_at: "2026-01-01T00:00:00.000Z",
};

const setProfile = vi.fn();
vi.mock("@/contexts/ProfileContext", () => ({
  useProfile: () => ({ profile: mockProfile, loading: false, refetch: vi.fn(), setProfile }),
}));

const logout = vi.fn();
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isLoggedIn: true, loading: false, user: { name: "Ana Teste" }, logout: (...a: unknown[]) => logout(...a) }),
}));

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...a: unknown[]) => toastError(...a), success: (...a: unknown[]) => toastSuccess(...a) },
}));

vi.mock("@/components/NotificationBell", () => ({ default: () => null }));

import Configuracoes from "./Configuracoes";
import { violacoesAcessibilidade } from "@/design/testes/acessibilidade";

// O consentimento para dados de saúde tem testes próprios
// (ConsentimentoSaudeContext.test.tsx); aqui a conta já consentiu.
vi.mock("@/contexts/ConsentimentoSaudeContext", () => ({
  useConsentimentoSaude: () => ({
    consentido: true,
    carregando: false,
    garantir: () => Promise.resolve(true),
    retirar: () => Promise.resolve(),
  }),
}));


async function abrirDialogoPassword(user: ReturnType<typeof userEvent.setup>) {
  const botao = await screen.findByRole("button", { name: "Mudar Palavra-passe" });
  await user.click(botao);
  return {
    actual: await screen.findByLabelText("Palavra-passe actual"),
    nova: screen.getByLabelText("Nova palavra-passe"),
    confirmar: screen.getByLabelText("Confirmar nova palavra-passe"),
    guardar: screen.getByRole("button", { name: /^Guardar$/ }),
  };
}

describe("Configuracoes — mudar palavra-passe", () => {
  beforeEach(() => {
    mudarPassword.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
  });

  it("recusa quando a palavra-passe actual está errada, e o dialogo continua aberto", async () => {
    mudarPassword.mockRejectedValue(new ApiErrorFalso(401, "password actual incorrecta"));
    const user = userEvent.setup();
    render(<Configuracoes />, { wrapper: MemoryRouter });

    const { actual, nova, confirmar, guardar } = await abrirDialogoPassword(user);
    await user.type(actual, "palavra-errada");
    await user.type(nova, "novaSenha123");
    await user.type(confirmar, "novaSenha123");
    await user.click(guardar);

    await waitFor(() => expect(mudarPassword).toHaveBeenCalledWith("palavra-errada", "novaSenha123"));
    expect(await within(screen.getByRole("dialog")).findByRole("alert")).toHaveTextContent("password actual incorrecta");
    expect(toastSuccess).not.toHaveBeenCalled();
    // o dialogo continua aberto — o utilizador nunca viu "sucesso" para algo que falhou
    expect(screen.getByLabelText("Palavra-passe actual")).toBeInTheDocument();
  });

  it("mostra sucesso real só depois de a API confirmar a mudança", async () => {
    mudarPassword.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<Configuracoes />, { wrapper: MemoryRouter });

    const { actual, nova, confirmar, guardar } = await abrirDialogoPassword(user);
    await user.type(actual, "senhaCerta1");
    await user.type(nova, "novaSenha123");
    await user.type(confirmar, "novaSenha123");
    await user.click(guardar);

    await waitFor(() => expect(mudarPassword).toHaveBeenCalledWith("senhaCerta1", "novaSenha123"));
    expect(toastError).not.toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalledWith("Palavra-passe actualizada com sucesso.");
  });

  it("nunca chama a API se as novas palavras-passe não coincidirem", async () => {
    const user = userEvent.setup();
    render(<Configuracoes />, { wrapper: MemoryRouter });

    const { actual, nova, confirmar, guardar } = await abrirDialogoPassword(user);
    await user.type(actual, "senhaCerta1");
    await user.type(nova, "novaSenha123");
    await user.type(confirmar, "outraCoisa");
    await user.click(guardar);

    expect(mudarPassword).not.toHaveBeenCalled();
    // O erro fica no campo, não num aviso que desaparece.
    expect(screen.getByText("As duas palavras-passe novas não coincidem.")).toBeInTheDocument();
  });

  it("nunca chama a API se a nova palavra-passe for demasiado curta", async () => {
    const user = userEvent.setup();
    render(<Configuracoes />, { wrapper: MemoryRouter });

    const { actual, nova, confirmar, guardar } = await abrirDialogoPassword(user);
    await user.type(actual, "senhaCerta1");
    await user.type(nova, "curta12");
    await user.type(confirmar, "curta12");
    await user.click(guardar);

    expect(mudarPassword).not.toHaveBeenCalled();
    expect(screen.getByText("A palavra-passe deve ter pelo menos 8 caracteres.")).toBeInTheDocument();
  });

  it("nunca chama a API se a nova palavra-passe não tiver letras nem números (AUTH-01)", async () => {
    const user = userEvent.setup();
    render(<Configuracoes />, { wrapper: MemoryRouter });

    const { actual, nova, confirmar, guardar } = await abrirDialogoPassword(user);
    await user.type(actual, "senhaCerta1");
    await user.type(nova, "12345678");
    await user.type(confirmar, "12345678");
    await user.click(guardar);

    expect(mudarPassword).not.toHaveBeenCalled();
    expect(screen.getByText("A palavra-passe precisa de pelo menos uma letra.")).toBeInTheDocument();
  });
});

async function abrirDialogoEliminar(user: ReturnType<typeof userEvent.setup>) {
  // "Eliminar Conta" aparece duas vezes (o rótulo e o botão) — ser específico ao papel.
  const botao = await screen.findByRole("button", { name: /Eliminar Conta/i });
  await user.click(botao);
  return {
    confirmar: await screen.findByRole("button", { name: /^Agendar eliminação$/ }),
  };
}

describe("Configuracoes — eliminar conta (agendada a 30 dias)", () => {
  beforeEach(() => {
    eliminar.mockReset();
    logout.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
  });

  it("nunca faz logout nem mostra sucesso se agendar falhar", async () => {
    eliminar.mockRejectedValue(new ApiErrorFalso(500, "boom"));
    const user = userEvent.setup();
    render(<Configuracoes />, { wrapper: MemoryRouter });

    const { confirmar } = await abrirDialogoEliminar(user);
    await user.click(confirmar);

    await waitFor(() => expect(eliminar).toHaveBeenCalled());
    expect(logout).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(await within(screen.getByRole("dialog")).findByRole("alert")).toHaveTextContent("boom");
    // o dialogo de confirmação continua visível — não fechou sozinho
    expect(screen.getByRole("button", { name: /^Agendar eliminação$/ })).toBeInTheDocument();
  });

  it("agenda para daqui a 30 dias, faz logout e mostra sucesso — nunca apaga na hora", async () => {
    eliminar.mockResolvedValue({ agendada_para: "2026-10-09T00:00:00.000Z" });
    const user = userEvent.setup();
    render(<Configuracoes />, { wrapper: MemoryRouter });

    const { confirmar } = await abrirDialogoEliminar(user);
    await user.click(confirmar);

    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
    expect(toastError).not.toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalledWith(
      "Conta agendada para eliminação dentro de 30 dias. Iniciar sessão de novo antes dessa data cancela o pedido."
    );
    // Nunca chama uma função de eliminação imediata — só agenda.
    expect(eliminar).toHaveBeenCalledTimes(1);
  });
});

describe("Configuracoes — sem controlos que não gravam nada", () => {
  // Caso real (2026-10-09): "Perfil público" mostrava "Preferências guardadas"
  // sem gravar nada -- nem existe na API.
  it("não há o interruptor 'Perfil público'", async () => {
    render(<Configuracoes />, { wrapper: MemoryRouter });
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByText(/Perfil Público/i)).not.toBeInTheDocument();
  });

  it("uma notificação que não se grava volta ao estado anterior e diz porquê", async () => {
    atualizarPerfil.mockReset().mockRejectedValue(new ApiErrorFalso(500, "falhou"));
    const user = userEvent.setup();
    render(<Configuracoes />, { wrapper: MemoryRouter });

    const opcao = await screen.findByRole("checkbox", { name: /Lembretes de Exercícios Visuais/i });
    expect(opcao).not.toBeChecked();
    await user.click(opcao);

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(opcao).not.toBeChecked();
  });

  // O texto da eliminação diz o que acontece de facto (anonimização, CLAUDE.md §4.7).
  it("a eliminação diz que os resultados ficam guardados sem identificação", async () => {
    const user = userEvent.setup();
    render(<Configuracoes />, { wrapper: MemoryRouter });
    await user.click(await screen.findByRole("button", { name: /Eliminar Conta/i }));
    expect(await screen.findByRole("dialog")).toHaveTextContent(/ficam guardados sem nada que o identifique/);
  });

  it("sem violações de acessibilidade", async () => {
    const { container } = render(<Configuracoes />, { wrapper: MemoryRouter });
    await screen.findByRole("heading", { level: 1 });
    expect(await violacoesAcessibilidade(container)).toEqual([]);
  });
});
