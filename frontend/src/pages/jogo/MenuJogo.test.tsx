import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const obterPerfil = vi.fn();
vi.mock("@/lib/apiClient", () => ({
  jogoApi: { obterPerfil: (...a: unknown[]) => obterPerfil(...a) },
}));
vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));
vi.mock("@/components/BackButton", () => ({ default: () => null }));

let mockProfile: { id: string; nome_completo: string; email: string; avatar_url: string | null } | null = null;
vi.mock("@/contexts/ProfileContext", () => ({
  useProfile: () => ({ profile: mockProfile }),
}));

import MenuJogo from "./MenuJogo";
import { CarteiraJogoProvider } from "@/contexts/CarteiraJogoContext";
import type { ReactNode } from "react";

const Envoltorio = ({ children }: { children: ReactNode }) => (
  <MemoryRouter>
    <CarteiraJogoProvider>{children}</CarteiraJogoProvider>
  </MemoryRouter>
);

describe("MenuJogo (Lobby)", () => {
  beforeEach(() => {
    obterPerfil.mockReset();
    mockProfile = null;
  });

  it("sem sessão, mostra o convite para entrar e não busca o perfil de jogo", async () => {
    render(<MenuJogo />, { wrapper: Envoltorio });

    expect(await screen.findByText("Convidado")).toBeInTheDocument();
    expect(screen.getByText(/Inicie sessão para guardar/i)).toBeInTheDocument();
    expect(obterPerfil).not.toHaveBeenCalled();
  });

  it("com sessão, mostra o nome e os saldos de moedas e diamantes", async () => {
    mockProfile = { id: "u1", nome_completo: "Ana Jogadora", email: "ana@example.com", avatar_url: null };
    obterPerfil.mockResolvedValue({ moedas: 320, diamantes: 4, partidas_jogadas: 6, patamar_maximo_alcancado: 8 });
    render(<MenuJogo />, { wrapper: Envoltorio });

    expect(await screen.findByText("Ana Jogadora")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("link", { name: /^Moedas/ })).toHaveTextContent("320"));
    expect(screen.getByRole("link", { name: /^Diamantes/ })).toHaveTextContent("4");
  });

  it("os diamantes são clicáveis e levam à Loja", async () => {
    mockProfile = { id: "u1", nome_completo: "Ana Jogadora", email: "ana@example.com", avatar_url: null };
    obterPerfil.mockResolvedValue({ moedas: 0, diamantes: 12, partidas_jogadas: 0, patamar_maximo_alcancado: 0 });
    render(<MenuJogo />, { wrapper: Envoltorio });

    expect(await screen.findByRole("link", { name: /^Diamantes/ })).toHaveAttribute("href", "/jogo-curiosidades/loja");
  });

  it("as moedas levam à Loja de Moedas e os diamantes à Loja de Diamantes", async () => {
    render(<MenuJogo />, { wrapper: Envoltorio });

    expect(await screen.findByRole("link", { name: /^Moedas: .* abrir a Loja de Moedas/ })).toHaveAttribute(
      "href",
      "/jogo-curiosidades/loja-moedas"
    );
    expect(screen.getByRole("link", { name: /^Diamantes/ })).toHaveAttribute("href", "/jogo-curiosidades/loja");
  });

  it("os três modos de jogo estão presentes, com os dois multijogador marcados 'Em breve'", async () => {
    render(<MenuJogo />, { wrapper: Envoltorio });

    expect(await screen.findByRole("link", { name: /Um Jogador/i })).toHaveAttribute(
      "href",
      "/jogo-curiosidades/jogar"
    );
    expect(screen.getByRole("button", { name: /Multijogador Local/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Multijogador Online/i })).toBeInTheDocument();
    expect(screen.getAllByText("Em breve")).toHaveLength(2);
  });

  it("clicar em 'Multijogador Online' abre o modal a explicar que está em desenvolvimento", async () => {
    render(<MenuJogo />, { wrapper: Envoltorio });

    await userEvent.click(screen.getByRole("button", { name: /Multijogador Online/i }));

    expect(await screen.findByText(/sistema de salas/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Entendi" }));
    await waitFor(() => expect(screen.queryByText(/sistema de salas/i)).not.toBeInTheDocument());
  });
});
