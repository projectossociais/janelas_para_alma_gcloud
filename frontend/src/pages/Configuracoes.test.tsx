import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

// --- mocks: isolamos Configuracoes.tsx dos providers reais (Supabase/Context) ---

const signInWithPassword = vi.fn();
const updateUser = vi.fn();
// Controla a resposta de supabase.from("profiles").update(payload).eq(...) —
// usado tanto por handleToggle (preferências) como por handleDelete (agendar
// eliminação). Devolve {data, error}; por omissão, sucesso sem dados.
const profilesUpdateMock = vi.fn(() => ({ data: null, error: null as { message: string } | null }));

// Mock genérico o suficiente para o resto da página (Navbar usa useSupabaseRole,
// que chama getSession/onAuthStateChange/from independentemente do que estamos
// a testar aqui) — sem isto, qualquer componente à volta do que testamos parte.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signInWithPassword: (...a: unknown[]) => signInWithPassword(...a),
      updateUser: (...a: unknown[]) => updateUser(...a),
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    from: (table: string) => {
      if (table === "profiles") {
        return {
          update: (payload: unknown) => ({
            eq: (_col: string, _val: string) => {
              const result = profilesUpdateMock(payload);
              // Precisa de ser awaitable directamente (handleDelete faz
              // `await ....eq(...)`) e também suportar `.select().single()`
              // (handleToggle) — daí anexar `select` a uma Promise normal.
              const thenable = Promise.resolve(result) as Promise<typeof result> & {
                select: () => { single: () => Promise<typeof result> };
              };
              thenable.select = () => ({ single: async () => result });
              return thenable;
            },
          }),
        };
      }
      return {
        select: () => ({ eq: async () => ({ data: [], error: null }) }),
        update: () => ({ eq: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) }) }),
      };
    },
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
  papel: "paciente",
  notificacoes_projetos: false,
  notificacoes_lembretes: false,
  notificacoes_comunidade: false,
};

vi.mock("@/contexts/ProfileContext", () => ({
  useProfile: () => ({ profile: mockProfile, loading: false, refetch: vi.fn(), setProfile: vi.fn() }),
}));

const logout = vi.fn();
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isLoggedIn: true, logout: (...a: unknown[]) => logout(...a) }),
}));

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...a: unknown[]) => toastError(...a), success: (...a: unknown[]) => toastSuccess(...a) },
}));

import Configuracoes from "./Configuracoes";

async function abrirDialogoPassword(user: ReturnType<typeof userEvent.setup>) {
  const botao = await screen.findByText("Mudar Palavra-passe");
  await user.click(botao);
  return {
    actual: await screen.findByLabelText("Palavra-passe atual"),
    nova: screen.getByLabelText("Nova palavra-passe"),
    confirmar: screen.getByLabelText("Confirmar nova palavra-passe"),
    guardar: screen.getByRole("button", { name: /^Guardar$/ }),
  };
}

describe("Configuracoes — mudar palavra-passe", () => {
  beforeEach(() => {
    signInWithPassword.mockReset();
    updateUser.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
  });

  it("recusa quando a palavra-passe actual está errada, e NUNCA chama updateUser", async () => {
    signInWithPassword.mockResolvedValue({ data: null, error: { message: "Invalid login credentials" } });
    const user = userEvent.setup();
    render(<Configuracoes />, { wrapper: MemoryRouter });

    const { actual, nova, confirmar, guardar } = await abrirDialogoPassword(user);
    await user.type(actual, "palavra-errada");
    await user.type(nova, "novaSenha123");
    await user.type(confirmar, "novaSenha123");
    await user.click(guardar);

    await waitFor(() => expect(signInWithPassword).toHaveBeenCalledWith({
      email: "ana@example.com",
      password: "palavra-errada",
    }));
    expect(updateUser).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("Palavra-passe atual incorreta.");
    expect(toastSuccess).not.toHaveBeenCalled();
    // o dialogo continua aberto — o utilizador nunca viu "sucesso" para algo que falhou
    expect(screen.getByLabelText("Palavra-passe atual")).toBeInTheDocument();
  });

  it("só chama updateUser depois de confirmar a palavra-passe actual, e mostra sucesso real", async () => {
    signInWithPassword.mockResolvedValue({ data: { user: {} }, error: null });
    updateUser.mockResolvedValue({ data: { user: {} }, error: null });
    const user = userEvent.setup();
    render(<Configuracoes />, { wrapper: MemoryRouter });

    const { actual, nova, confirmar, guardar } = await abrirDialogoPassword(user);
    await user.type(actual, "senhaCerta1");
    await user.type(nova, "novaSenha123");
    await user.type(confirmar, "novaSenha123");
    await user.click(guardar);

    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ password: "novaSenha123" }));
    expect(toastError).not.toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalledWith("Palavra-passe atualizada com sucesso.");
  });

  it("nunca chama o Supabase se as novas palavras-passe não coincidirem", async () => {
    const user = userEvent.setup();
    render(<Configuracoes />, { wrapper: MemoryRouter });

    const { actual, nova, confirmar, guardar } = await abrirDialogoPassword(user);
    await user.type(actual, "senhaCerta1");
    await user.type(nova, "novaSenha123");
    await user.type(confirmar, "outraCoisa");
    await user.click(guardar);

    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("Verifique os campos da palavra-passe.");
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
    profilesUpdateMock.mockReset();
    profilesUpdateMock.mockReturnValue({ data: null, error: null });
    logout.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
  });

  it("nunca faz logout nem mostra sucesso se agendar falhar", async () => {
    profilesUpdateMock.mockReturnValue({ data: null, error: { message: "boom" } });
    const user = userEvent.setup();
    render(<Configuracoes />, { wrapper: MemoryRouter });

    const { confirmar } = await abrirDialogoEliminar(user);
    await user.click(confirmar);

    await waitFor(() => expect(profilesUpdateMock).toHaveBeenCalled());
    expect(logout).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("Não foi possível agendar a eliminação. Tente novamente.");
    // o dialogo de confirmação continua visível — não fechou sozinho
    expect(screen.getByRole("button", { name: /^Agendar eliminação$/ })).toBeInTheDocument();
  });

  it("agenda para daqui a 30 dias, faz logout e mostra sucesso — nunca apaga na hora", async () => {
    const user = userEvent.setup();
    render(<Configuracoes />, { wrapper: MemoryRouter });

    const { confirmar } = await abrirDialogoEliminar(user);
    await user.click(confirmar);

    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
    expect(toastError).not.toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalledWith(
      "Conta agendada para eliminação dentro de 30 dias. Iniciar sessão de novo antes dessa data cancela o pedido."
    );

    // Nunca chama uma função de eliminação imediata — só agenda uma data.
    expect(profilesUpdateMock).toHaveBeenCalledTimes(1);
    const payload = profilesUpdateMock.mock.calls[0][0] as { eliminar_agendado_para: string };
    expect(payload.eliminar_agendado_para).toBeTypeOf("string");
    const agendadaPara = new Date(payload.eliminar_agendado_para).getTime();
    const daqui29Dias = Date.now() + 29 * 24 * 60 * 60 * 1000;
    const daqui31Dias = Date.now() + 31 * 24 * 60 * 60 * 1000;
    expect(agendadaPara).toBeGreaterThan(daqui29Dias);
    expect(agendadaPara).toBeLessThan(daqui31Dias);
  });
});
