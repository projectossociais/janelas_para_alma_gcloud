import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const obterPorSlug = vi.fn();
vi.mock("@/lib/apiClient", () => ({
  publicacoesApi: { obterPorSlug: (...a: unknown[]) => obterPorSlug(...a) },
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

import PublicacaoDetalhe from "./PublicacaoDetalhe";

function renderComSlug(slug: string) {
  return render(
    <MemoryRouter initialEntries={[`/publicacoes/${slug}`]}>
      <Routes>
        <Route path="/publicacoes/:slug" element={<PublicacaoDetalhe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("PublicacaoDetalhe", () => {
  beforeEach(() => {
    obterPorSlug.mockReset();
    toastError.mockReset();
  });

  it("mostra 'não encontrada' para um 404 -- nunca finge que a publicação existe", async () => {
    obterPorSlug.mockRejectedValue(Object.assign(new Error("publicação não encontrada"), { status: 404 }));
    renderComSlug("rascunho-secreto");

    expect(await screen.findByText(/Publicação não encontrada/i)).toBeInTheDocument();
    expect(toastError).not.toHaveBeenCalled();
  });

  it("mostra o conteúdo completo de uma publicação encontrada", async () => {
    obterPorSlug.mockResolvedValue({
      id: "pub-1",
      slug: "campanha-gamek",
      titulo: "Campanha Gamek",
      resumo: "resumo curto",
      corpo: "texto completo do evento",
      local: "Gamek, Luanda",
      data_evento: "2026-09-12",
      capa_url: null,
      midias: [{ id: "m1", url: "https://cdn.test/foto1.jpg", ordem: 1 }],
    });
    renderComSlug("campanha-gamek");

    expect(await screen.findByRole("heading", { name: "Campanha Gamek" })).toBeInTheDocument();
    expect(screen.getByText("texto completo do evento")).toBeInTheDocument();
    expect(screen.getByText("Galeria de Fotos")).toBeInTheDocument();
  });

  it("mostra um erro genérico quando a API falha por outro motivo", async () => {
    obterPorSlug.mockRejectedValue(Object.assign(new Error("falhou"), { status: 500 }));
    renderComSlug("campanha-gamek");

    await screen.findByText(/Voltar às publicações/i);
    expect(toastError).toHaveBeenCalledWith("falhou");
  });
});
