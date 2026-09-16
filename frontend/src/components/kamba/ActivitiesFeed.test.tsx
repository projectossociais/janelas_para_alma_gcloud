import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// ADMIN-03: a secção deixou de mostrar uma campanha fixa escrita em código
// -- passa a vir de /publicacoes. O que importa testar é que nunca finge
// dados que não existem (some por completo se não houver nada publicado).

const listarPublicadas = vi.fn();
vi.mock("@/lib/apiClient", () => ({
  publicacoesApi: { listarPublicadas: (...a: unknown[]) => listarPublicadas(...a) },
}));

import ActivitiesFeed from "./ActivitiesFeed";

const publicacao = (over: Partial<Record<string, unknown>> = {}) => ({
  id: "pub-1",
  slug: "campanha-gamek",
  titulo: "Campanha de Conscientização sobre o Estrabismo",
  resumo: "Acompanhe a nossa ação na Gamek.",
  local: "Gamek, Luanda",
  data_evento: "2026-09-12",
  capa_url: null,
  midias: [],
  ...over,
});

describe("ActivitiesFeed", () => {
  beforeEach(() => {
    listarPublicadas.mockReset();
  });

  it("não mostra nada enquanto não há publicações", async () => {
    listarPublicadas.mockResolvedValue([]);
    render(<ActivitiesFeed />, { wrapper: MemoryRouter });

    await waitFor(() => expect(listarPublicadas).toHaveBeenCalled());
    expect(screen.queryByText(/Ações Recentes/i)).not.toBeInTheDocument();
  });

  it("não mostra nada quando a API falha", async () => {
    listarPublicadas.mockRejectedValue(new Error("falhou"));
    render(<ActivitiesFeed />, { wrapper: MemoryRouter });

    await waitFor(() => expect(listarPublicadas).toHaveBeenCalled());
    expect(screen.queryByText(/Ações Recentes/i)).not.toBeInTheDocument();
  });

  it("mostra as publicações reais devolvidas pela API, com link para o detalhe", async () => {
    listarPublicadas.mockResolvedValue([publicacao()]);
    render(<ActivitiesFeed />, { wrapper: MemoryRouter });

    expect(await screen.findByText("Campanha de Conscientização sobre o Estrabismo")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Ver Publicação Completa/i });
    expect(link).toHaveAttribute("href", "/publicacoes/campanha-gamek");
  });

  it("mostra no máximo duas publicações", async () => {
    listarPublicadas.mockResolvedValue([
      publicacao({ id: "pub-1", slug: "um", titulo: "Primeira" }),
      publicacao({ id: "pub-2", slug: "dois", titulo: "Segunda" }),
      publicacao({ id: "pub-3", slug: "tres", titulo: "Terceira" }),
    ]);
    render(<ActivitiesFeed />, { wrapper: MemoryRouter });

    await screen.findByText("Primeira");
    expect(screen.getByText("Segunda")).toBeInTheDocument();
    expect(screen.queryByText("Terceira")).not.toBeInTheDocument();
  });
});
