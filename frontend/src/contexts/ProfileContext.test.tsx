import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

const obterPerfil = vi.fn();
let mockAuth = { isLoggedIn: false, loading: false };

vi.mock("@/lib/apiClient", () => ({
  perfilApi: { obter: () => obterPerfil() },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockAuth,
}));

import { ProfileProvider, useProfile } from "./ProfileContext";

const PERFIL_API = {
  id: "user-1",
  email: "ana@example.com",
  papel: "comum",
  nome_completo: "Ana Teste",
  biografia: null,
  telefone: null,
  data_nascimento: null,
  genero: null,
  provincia: null,
  avatar_url: null,
  notificacoes_projetos: false,
  notificacoes_lembretes: false,
  notificacoes_comunidade: false,
  criado_em: "2026-01-01T00:00:00.000Z",
};

function renderProfile() {
  return renderHook(() => useProfile(), { wrapper: ProfileProvider });
}

describe("ProfileContext", () => {
  beforeEach(() => {
    obterPerfil.mockReset();
    mockAuth = { isLoggedIn: false, loading: false };
  });

  it("não pede o perfil enquanto a sessão ainda está a ser verificada", () => {
    mockAuth = { isLoggedIn: false, loading: true };
    renderProfile();

    expect(obterPerfil).not.toHaveBeenCalled();
  });

  it("sem sessão, fica sem perfil e sem pedir nada à API", async () => {
    mockAuth = { isLoggedIn: false, loading: false };
    const { result } = renderProfile();

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(obterPerfil).not.toHaveBeenCalled();
    expect(result.current.profile).toBeNull();
  });

  it("com sessão, carrega o perfil da API", async () => {
    mockAuth = { isLoggedIn: true, loading: false };
    obterPerfil.mockResolvedValue(PERFIL_API);
    const { result } = renderProfile();

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.profile?.nome_completo).toBe("Ana Teste");
    expect(result.current.profile?.created_at).toBe("2026-01-01T00:00:00.000Z");
  });

  it("se o pedido falhar, fica sem perfil em vez de propagar o erro", async () => {
    mockAuth = { isLoggedIn: true, loading: false };
    obterPerfil.mockRejectedValue(new Error("falha de rede"));
    const { result } = renderProfile();

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.profile).toBeNull();
  });

  it("setProfile actualiza o estado local sem pedir nada à API", async () => {
    mockAuth = { isLoggedIn: true, loading: false };
    obterPerfil.mockResolvedValue(PERFIL_API);
    const { result } = renderProfile();
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setProfile({ ...result.current.profile!, nome_completo: "Novo Nome" });
    });

    await waitFor(() => expect(result.current.profile?.nome_completo).toBe("Novo Nome"));
    expect(obterPerfil).toHaveBeenCalledTimes(1);
  });
});
