import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

const obterPerfil = vi.fn();
const obterLojaDiamantes = vi.fn();
const comprarPacoteDiamantes = vi.fn();
vi.mock("@/lib/apiClient", () => ({
  jogoApi: {
    obterPerfil: (...a: unknown[]) => obterPerfil(...a),
    obterLojaDiamantes: (...a: unknown[]) => obterLojaDiamantes(...a),
    comprarPacoteDiamantes: (...a: unknown[]) => comprarPacoteDiamantes(...a),
  },
  mensagemDeErroApi: (err: unknown, fallback: string) => {
    const status = (err as { status?: unknown } | null)?.status;
    const message = (err as { message?: unknown } | null)?.message;
    return typeof status === "number" && typeof message === "string" ? message : fallback;
  },
}));
vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));
vi.mock("@/components/BackButton", () => ({ default: () => null }));

let mockProfile: { id: string; nome_completo: string; email: string; avatar_url: string | null } | null = null;
vi.mock("@/contexts/ProfileContext", () => ({ useProfile: () => ({ profile: mockProfile }) }));

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...a: unknown[]) => toastError(...a), success: (...a: unknown[]) => toastSuccess(...a) },
}));

import LojaDiamantes from "./LojaDiamantes";
import { CarteiraJogoProvider } from "@/contexts/CarteiraJogoContext";

const Envoltorio = ({ children }: { children: ReactNode }) => (
  <MemoryRouter>
    <CarteiraJogoProvider>{children}</CarteiraJogoProvider>
  </MemoryRouter>
);

const PACOTES = [
  { id: "pequeno", diamantes: 50, bonus: 0, total_diamantes: 50, preco_kz: 500 },
  { id: "medio", diamantes: 150, bonus: 15, total_diamantes: 165, preco_kz: 1250 },
  { id: "grande", diamantes: 400, bonus: 80, total_diamantes: 480, preco_kz: 3000 },
];

const PERFIL = { moedas: 100, diamantes: 10, partidas_jogadas: 2, patamar_maximo_alcancado: 3 };

describe("LojaDiamantes", () => {
  beforeEach(() => {
    obterPerfil.mockReset();
    obterLojaDiamantes.mockReset();
    comprarPacoteDiamantes.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
    mockProfile = { id: "u1", nome_completo: "Ana", email: "ana@example.com", avatar_url: null };
    obterPerfil.mockResolvedValue(PERFIL);
  });

  it("mostra os pacotes vindos da API, com preço em Kz e bónus", async () => {
    obterLojaDiamantes.mockResolvedValue({ pacotes: PACOTES, pagamento_simulado: true });
    render(<LojaDiamantes />, { wrapper: Envoltorio });

    const medio = await screen.findByTestId("pacote-medio");
    expect(within(medio).getByText("165")).toBeInTheDocument();
    expect(within(medio).getByText(/\+15/)).toBeInTheDocument();
    expect(within(medio).getByRole("button", { name: /165 diamantes por Kz 1\.250/ })).toBeEnabled();
    expect(screen.getByTestId("pacote-grande")).toHaveTextContent("Melhor valor");
  });

  it("comprar (simulado) confirma, credita pela resposta da API e actualiza a barra", async () => {
    obterLojaDiamantes.mockResolvedValue({ pacotes: PACOTES, pagamento_simulado: true });
    comprarPacoteDiamantes.mockResolvedValue({ ...PERFIL, diamantes: 60 });
    render(<LojaDiamantes />, { wrapper: Envoltorio });

    await waitFor(() => expect(screen.getByRole("link", { name: /^Diamantes/ })).toHaveTextContent("10"));
    await userEvent.click(await screen.findByRole("button", { name: /50 diamantes por Kz 500/ }));
    await userEvent.click(await screen.findByRole("button", { name: /Pagar \(simulado\)/ }));

    await waitFor(() => expect(comprarPacoteDiamantes).toHaveBeenCalledWith("pequeno"));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(screen.getByRole("link", { name: /^Diamantes/ })).toHaveTextContent("60");
  });

  it("se a compra falhar, mostra erro e nunca sucesso, sem mexer no saldo", async () => {
    obterLojaDiamantes.mockResolvedValue({ pacotes: PACOTES, pagamento_simulado: true });
    comprarPacoteDiamantes.mockRejectedValue(Object.assign(new Error("indisponível"), { status: 503 }));
    render(<LojaDiamantes />, { wrapper: Envoltorio });

    await waitFor(() => expect(screen.getByRole("link", { name: /^Diamantes/ })).toHaveTextContent("10"));
    await userEvent.click(await screen.findByRole("button", { name: /480 diamantes/ }));
    await userEvent.click(await screen.findByRole("button", { name: /Pagar \(simulado\)/ }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("indisponível"));
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: /^Diamantes/, hidden: true })).toHaveTextContent("10");
  });

  it("sem pagamento disponível, os botões ficam desactivados e aparece o aviso", async () => {
    obterLojaDiamantes.mockResolvedValue({ pacotes: PACOTES, pagamento_simulado: false });
    render(<LojaDiamantes />, { wrapper: Envoltorio });

    expect(await screen.findByText(/disponível em breve/i)).toBeInTheDocument();
    for (const b of screen.getAllByRole("button", { name: /diamantes por/ })) expect(b).toBeDisabled();
  });

  it("sem sessão, pede para entrar em vez de comprar", async () => {
    mockProfile = null;
    obterLojaDiamantes.mockResolvedValue({ pacotes: PACOTES, pagamento_simulado: true });
    render(<LojaDiamantes />, { wrapper: Envoltorio });

    expect(await screen.findAllByRole("link", { name: "Entrar para comprar" })).toHaveLength(3);
    expect(obterPerfil).not.toHaveBeenCalled();
  });

  it("se a loja não carregar, mostra erro com opção de tentar outra vez", async () => {
    obterLojaDiamantes.mockRejectedValueOnce(new Error("rede")).mockResolvedValueOnce({ pacotes: PACOTES, pagamento_simulado: true });
    render(<LojaDiamantes />, { wrapper: Envoltorio });

    await userEvent.click(await screen.findByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByTestId("pacote-pequeno")).toBeInTheDocument();
  });
});
