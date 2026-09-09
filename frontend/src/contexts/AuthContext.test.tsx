import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor, act } from "@testing-library/react";

// --- mocks: controlamos manualmente o "evento" de login do Supabase ---
// Nota: o import de AuthContext tem de vir DEPOIS destes mocks (mais abaixo
// neste ficheiro) — o Vitest executa os módulos por ordem de aparição no
// ficheiro, não pela ordem "ESM pura"; um import no topo executaria o
// AuthContext.tsx (e a sua própria importação do cliente Supabase) antes
// destas consts existirem.

const getSession = vi.fn();
let authStateCallback: ((event: string, session: unknown) => void) | null = null;
const onAuthStateChange = vi.fn((cb: (event: string, session: unknown) => void) => {
  authStateCallback = cb;
  return { data: { subscription: { unsubscribe: () => {} } } };
});

const profilesSelectEqMaybeSingle = vi.fn();
const profilesUpdateEq = vi.fn();
const toastSuccess = vi.fn();

vi.mock("sonner", () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: vi.fn() },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      // Referenciar como funções-seta (não a forma abreviada { getSession })
      // é o que importa aqui: a forma abreviada avalia a variável já na
      // construção do objecto (quando a factory corre), não quando a função
      // é chamada — e nessa altura ainda estamos em TDZ.
      getSession: () => getSession(),
      onAuthStateChange: (cb: (event: string, session: unknown) => void) => onAuthStateChange(cb),
    },
    from: (table: string) => {
      if (table !== "profiles") return { select: () => ({ eq: async () => ({ data: [], error: null }) }) };
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => profilesSelectEqMaybeSingle() }),
        }),
        update: (payload: unknown) => ({
          eq: async () => profilesUpdateEq(payload),
        }),
      };
    },
  },
}));

import { AuthProvider } from "./AuthContext";

const SESSION_COM_LOGIN = {
  user: { id: "user-1", email: "ana@example.com", user_metadata: {} },
};

describe("AuthContext — cancela eliminação agendada ao voltar a entrar", () => {
  beforeEach(() => {
    getSession.mockReset();
    getSession.mockResolvedValue({ data: { session: null } });
    profilesSelectEqMaybeSingle.mockReset();
    profilesUpdateEq.mockReset();
    profilesUpdateEq.mockResolvedValue({ error: null });
    toastSuccess.mockReset();
    authStateCallback = null;
  });

  it("cancela e avisa quando a conta tinha uma eliminação agendada", async () => {
    profilesSelectEqMaybeSingle.mockResolvedValue({
      data: { eliminar_agendado_para: "2026-12-01T00:00:00.000Z" },
      error: null,
    });

    render(
      <AuthProvider>
        <div />
      </AuthProvider>
    );

    await waitFor(() => expect(authStateCallback).not.toBeNull());
    await act(async () => { authStateCallback!("SIGNED_IN", SESSION_COM_LOGIN); });

    await waitFor(() =>
      expect(profilesUpdateEq).toHaveBeenCalledWith({ eliminar_agendado_para: null })
    );
    expect(toastSuccess).toHaveBeenCalledWith(
      "A eliminação da sua conta foi cancelada. Bem-vindo de volta."
    );
  });

  it("não faz nada (nem toast) quando não há eliminação agendada", async () => {
    profilesSelectEqMaybeSingle.mockResolvedValue({
      data: { eliminar_agendado_para: null },
      error: null,
    });

    render(
      <AuthProvider>
        <div />
      </AuthProvider>
    );

    await waitFor(() => expect(authStateCallback).not.toBeNull());
    await act(async () => { authStateCallback!("SIGNED_IN", SESSION_COM_LOGIN); });

    // dá tempo à promise correr, sem haver nada para esperar por "toHaveBeenCalled"
    await new Promise((r) => setTimeout(r, 20));
    expect(profilesUpdateEq).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("nunca impede o login de continuar se a consulta ao perfil falhar", async () => {
    profilesSelectEqMaybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } });

    render(
      <AuthProvider>
        <div />
      </AuthProvider>
    );

    await waitFor(() => expect(authStateCallback).not.toBeNull());
    // não deve lançar nem rejeitar de forma não apanhada
    await act(async () => {
      expect(() => authStateCallback!("SIGNED_IN", SESSION_COM_LOGIN)).not.toThrow();
    });

    await new Promise((r) => setTimeout(r, 20));
    expect(profilesUpdateEq).not.toHaveBeenCalled();
  });
});
