import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const listarPublicadas = vi.fn();
vi.mock("@/lib/apiClient", () => ({
  publicacoesApi: { listarPublicadas: (...a: unknown[]) => listarPublicadas(...a) },
  mensagemDeErroApi: (err: unknown, fallback: string) => {
    const status = (err as { status?: unknown } | null)?.status;
    const message = (err as { message?: unknown } | null)?.message;
    return typeof status === "number" && typeof message === "string" ? message : fallback;
  },
}));
vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));

const toastError = vi.fn();
vi.mock("sonner", () => ({ toast: { error: (...a: unknown[]) => toastError(...a) } }));

import Publicacoes from "./Publicacoes";

describe("Publicacoes (lista pública)", () => {
  beforeEach(() => {
    listarPublicadas.mockReset();
    toastError.mockReset();
  });

  it("mostra o estado vazio quando não há publicações", async () => {
    listarPublicadas.mockResolvedValue([]);
    render(<Publicacoes />, { wrapper: MemoryRouter });

    expect(await screen.findByText(/Ainda não há publicações/i)).toBeInTheDocument();
  });

  it("lista as publicações devolvidas, cada uma a linkar para o detalhe", async () => {
    listarPublicadas.mockResolvedValue([
      {
        id: "pub-1",
        slug: "campanha-gamek",
        titulo: "Campanha Gamek",
        resumo: "resumo",
        local: "Luanda",
        data_evento: "2026-09-12",
        capa_url: null,
        midias: [],
      },
    ]);
    render(<Publicacoes />, { wrapper: MemoryRouter });

    const link = await screen.findByRole("link", { name: /Campanha Gamek/i });
    expect(link).toHaveAttribute("href", "/publicacoes/campanha-gamek");
  });

  it("mostra um erro quando a API falha, sem rebentar a página", async () => {
    listarPublicadas.mockRejectedValue(Object.assign(new Error("falhou"), { status: 500 }));
    render(<Publicacoes />, { wrapper: MemoryRouter });

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("falhou"));
  });
});
