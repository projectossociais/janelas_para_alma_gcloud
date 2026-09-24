import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
const PUBLICACAO = {
  id: "pub-1",
  slug: "campanha-gamek",
  titulo: "Campanha Gamek",
  resumo: "resumo curto",
  corpo: "texto completo do evento",
  local: "Gamek, Luanda",
  data_evento: "2026-09-12",
  capa_url: null,
  midias: [{ id: "m1", url: "https://cdn.test/foto1.jpg", ordem: 1 }],
};
vi.mock("sonner", () => ({ toast: { error: (...a: unknown[]) => toastError(...a) } }));

import PublicacaoDetalhe from "./PublicacaoDetalhe";
import i18n from "@/i18n";

function renderComSlug(slug: string, prefixo = "/publicacoes") {
  return render(
    <MemoryRouter initialEntries={[`${prefixo}/${slug}`]}>
      <Routes>
        <Route path={`${prefixo}/:slug`} element={<PublicacaoDetalhe />} />
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

  it("em português não mostra o aviso de idioma", async () => {
    obterPorSlug.mockResolvedValue(PUBLICACAO);
    renderComSlug("campanha-gamek");

    expect(await screen.findByRole("heading", { name: "Campanha Gamek" })).not.toHaveAttribute("lang");
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  describe("no site inglês (/en/publications/:slug)", () => {
    beforeEach(() => {
      vi.stubEnv("VITE_ENABLE_EN", "true");
      void i18n.changeLanguage("en-US");
    });
    afterEach(() => {
      vi.unstubAllEnvs();
      void i18n.changeLanguage("pt-AO");
    });

    it("avisa que a publicação só existe em português e marca o conteúdo com lang", async () => {
      obterPorSlug.mockResolvedValue(PUBLICACAO);
      renderComSlug("campanha-gamek", "/en/publications");

      expect(await screen.findByRole("heading", { name: "Campanha Gamek" })).toHaveAttribute("lang", "pt-AO");
      expect(screen.getByText("texto completo do evento")).toHaveAttribute("lang", "pt-AO");
      expect(screen.getByRole("note")).toHaveTextContent("This post is available in Portuguese only.");
      // estrutura da página em inglês
      expect(screen.getByText("Photo Gallery")).toBeInTheDocument();
      expect(screen.getByText("September 12, 2026")).toBeInTheDocument();
    });

    it("404 em inglês: 'Post not found' com link para /en/publications", async () => {
      obterPorSlug.mockRejectedValue(Object.assign(new Error("publicação não encontrada"), { status: 404 }));
      renderComSlug("nao-existe", "/en/publications");

      expect(await screen.findByRole("heading", { name: "Post not found" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "View all posts" })).toHaveAttribute("href", "/en/publications");
    });
  });
});
