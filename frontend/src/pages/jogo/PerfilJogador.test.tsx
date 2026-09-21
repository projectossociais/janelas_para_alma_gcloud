import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const navigateMock = vi.fn();
vi.mock("react-router-dom", async (importarOriginal) => {
  const original = await importarOriginal<typeof import("react-router-dom")>();
  return { ...original, useNavigate: () => navigateMock };
});

const obterPerfil = vi.fn();
vi.mock("@/lib/apiClient", () => ({
  jogoApi: { obterPerfil: (...a: unknown[]) => obterPerfil(...a) },
  mensagemDeErroApi: (err: unknown, fallback: string) => {
    const status = (err as { status?: unknown } | null)?.status;
    const message = (err as { message?: unknown } | null)?.message;
    return typeof status === "number" && typeof message === "string" ? message : fallback;
  },
}));
vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));
vi.mock("@/components/BackButton", () => ({ default: () => null }));

const mockUseAuth = vi.fn();
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => mockUseAuth() }));

vi.mock("@/contexts/ProfileContext", () => ({
  useProfile: () => ({ profile: { id: "u1", nome_completo: "Ana Jogadora", email: "ana@example.com", avatar_url: null } }),
}));

const toastError = vi.fn();
vi.mock("sonner", () => ({ toast: { error: (...a: unknown[]) => toastError(...a) } }));

import PerfilJogador from "./PerfilJogador";

describe("PerfilJogador", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    obterPerfil.mockReset();
    toastError.mockReset();
  });

  it("redireciona para /auth quando não há sessão", async () => {
    mockUseAuth.mockReturnValue({ isLoggedIn: false, loading: false });
    render(<PerfilJogador />, { wrapper: MemoryRouter });

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/auth"));
  });

  it("não redireciona enquanto o AuthContext ainda está a carregar", async () => {
    mockUseAuth.mockReturnValue({ isLoggedIn: false, loading: true });
    render(<PerfilJogador />, { wrapper: MemoryRouter });

    await new Promise((r) => setTimeout(r, 50));
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("mostra as estatísticas do perfil de jogo", async () => {
    mockUseAuth.mockReturnValue({ isLoggedIn: true, loading: false });
    obterPerfil.mockResolvedValue({ moedas: 500, diamantes: 7, partidas_jogadas: 12, patamar_maximo_alcancado: 10 });
    render(<PerfilJogador />, { wrapper: MemoryRouter });

    expect(await screen.findByText("500")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("Kz 50.000")).toBeInTheDocument(); // valor do patamar 10
  });

  it("mostra um erro amigável quando a API falha, sem rebentar a página", async () => {
    mockUseAuth.mockReturnValue({ isLoggedIn: true, loading: false });
    obterPerfil.mockRejectedValue(Object.assign(new Error("falhou"), { status: 500 }));
    render(<PerfilJogador />, { wrapper: MemoryRouter });

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("falhou"));
    expect(await screen.findByRole("link", { name: /Jogar agora/i })).toBeInTheDocument();
  });
});
