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

describe("MenuJogo (Lobby)", () => {
  beforeEach(() => {
    obterPerfil.mockReset();
    mockProfile = null;
  });

  it("sem sessão, mostra o convite para entrar e não busca o perfil de jogo", async () => {
    render(<MenuJogo />, { wrapper: MemoryRouter });

    expect(await screen.findByText("Convidado")).toBeInTheDocument();
    expect(screen.getByText(/Inicie sessão para guardar/i)).toBeInTheDocument();
    expect(obterPerfil).not.toHaveBeenCalled();
  });

  it("com sessão, mostra o nome e os saldos de moedas e diamantes", async () => {
    mockProfile = { id: "u1", nome_completo: "Ana Jogadora", email: "ana@example.com", avatar_url: null };
    obterPerfil.mockResolvedValue({ moedas: 320, diamantes: 4, partidas_jogadas: 6, patamar_maximo_alcancado: 8 });
    render(<MenuJogo />, { wrapper: MemoryRouter });

    expect(await screen.findByText("Ana Jogadora")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Moedas")).toHaveTextContent("320"));
    expect(screen.getByLabelText("Diamantes")).toHaveTextContent("4");
  });

  it("os três modos de jogo estão presentes, com os dois multijogador marcados 'Em breve'", async () => {
    render(<MenuJogo />, { wrapper: MemoryRouter });

    expect(await screen.findByRole("link", { name: /Um Jogador/i })).toHaveAttribute(
      "href",
      "/jogo-curiosidades/jogar"
    );
    expect(screen.getByRole("button", { name: /Multijogador Local/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Multijogador Online/i })).toBeInTheDocument();
    expect(screen.getAllByText("Em breve")).toHaveLength(2);
  });

  it("clicar em 'Multijogador Online' abre o modal a explicar que está em desenvolvimento", async () => {
    render(<MenuJogo />, { wrapper: MemoryRouter });

    await userEvent.click(screen.getByRole("button", { name: /Multijogador Online/i }));

    expect(await screen.findByText(/sistema de salas/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Entendi" }));
    await waitFor(() => expect(screen.queryByText(/sistema de salas/i)).not.toBeInTheDocument());
  });
});
