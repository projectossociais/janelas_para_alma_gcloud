import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// A guarda de sessão de EditarPerfil.tsx já mandou um utilizador COM sessão
// válida para /auth, num hard refresh: o AuthContext ainda estava a validar
// a sessão (/auth/eu em curso, `loading: true`, `user` ainda `null`), e a
// guarda decidia com base num `isLoggedIn` que ainda não tinha a resposta
// certa. Estes testes fixam exactamente essa condição de corrida.

const navigateMock = vi.fn();
vi.mock("react-router-dom", async (importarOriginal) => {
  const original = await importarOriginal<typeof import("react-router-dom")>();
  return { ...original, useNavigate: () => navigateMock };
});

vi.mock("@/lib/apiClient", () => ({
  perfilApi: { atualizar: vi.fn() },
  uploadsApi: { prepararAvatar: vi.fn(), enviarParaStorage: vi.fn(), confirmarAvatar: vi.fn() },
  TIPOS_DE_AVATAR_ACEITES: ["image/png", "image/jpeg", "image/webp"],
  mensagemDeErroApi: (_err: unknown, fallback: string) => fallback,
}));

vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));

vi.mock("@/contexts/ProfileContext", () => ({
  useProfile: () => ({ profile: null, loading: true, setProfile: vi.fn() }),
}));

const mockUseAuth = vi.fn();
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
  PROVINCES: ["Luanda", "Benguela"],
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

import EditarPerfil from "./EditarPerfil";

describe("EditarPerfil — guarda de sessão espera o AuthContext resolver", () => {
  beforeEach(() => {
    navigateMock.mockReset();
  });

  it("não redireciona enquanto o AuthContext ainda está a validar a sessão (loading: true)", async () => {
    mockUseAuth.mockReturnValue({ isLoggedIn: false, loading: true, user: null, updateUserProfile: vi.fn() });
    render(<EditarPerfil />, { wrapper: MemoryRouter });

    // Dar tempo a um efeito indevido correr, se o bug tivesse voltado.
    await new Promise((r) => setTimeout(r, 10));
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("redireciona para /auth só depois de o AuthContext confirmar que não há sessão", async () => {
    mockUseAuth.mockReturnValue({ isLoggedIn: false, loading: false, user: null, updateUserProfile: vi.fn() });
    render(<EditarPerfil />, { wrapper: MemoryRouter });

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/auth"));
  });

  it("não redireciona quando o AuthContext confirma sessão válida", async () => {
    mockUseAuth.mockReturnValue({
      isLoggedIn: true,
      loading: false,
      user: { id: "user-1" },
      updateUserProfile: vi.fn(),
    });
    render(<EditarPerfil />, { wrapper: MemoryRouter });

    await new Promise((r) => setTimeout(r, 10));
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
