import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

const listarPublicadas = vi.fn();
vi.mock("@/lib/apiClient", () => ({
  publicacoesApi: { listarPublicadas: (...a: unknown[]) => listarPublicadas(...a) },
}));

import i18n from "@/i18n";
import NovidadesSection from "./NovidadesSection";

function publicacao(n: number, extra: Record<string, unknown> = {}) {
  return {
    id: `p${n}`,
    slug: `publicacao-${n}`,
    titulo: `Publicação ${n}`,
    resumo: `resumo ${n}`,
    corpo: "c",
    local: null,
    data_evento: null,
    capa_url: null,
    midias: [],
    visualizacoes: 0,
    gostos: 0,
    gostei: false,
    ...extra,
  };
}

beforeEach(() => {
  listarPublicadas.mockReset();
  listarPublicadas.mockResolvedValue([]);
});

describe("NovidadesSection -- cartão da firma Olhar Alinhado", () => {
  afterEach(async () => {
    await i18n.changeLanguage("pt-AO");
  });

  it("mostra o cartão com tag e resumo, e 'Saiba mais...' abre o modal com o detalhe", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <NovidadesSection />
      </MemoryRouter>,
    );

    const cartao = screen.getByRole("button", { name: /Oficialização da Nossa Firma Comercial/i });
    expect(within(cartao).getByText("Institucional / Marco")).toBeInTheDocument();
    expect(within(cartao).getByText(/constituição da Olhar Alinhado/i)).toBeInTheDocument();
    expect(within(cartao).getByText("Saiba mais...")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(cartao);

    const modal = await screen.findByRole("dialog");
    expect(within(modal).getByRole("heading", { name: /Um Novo Capítulo/i })).toBeInTheDocument();
    expect(within(modal).getByText(/Compromisso com a transparência/i)).toBeInTheDocument();
    expect(within(modal).getByText(/teleconsultas médicas especializadas/i)).toBeInTheDocument();
  });

  it("os outros cartões continuam a ser links", () => {
    render(
      <MemoryRouter>
        <NovidadesSection />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: /Notícias sobre a Saúde Visual/i })).toHaveAttribute(
      "href",
      "https://www.cnnbrasil.com.br/tudo-sobre/saude-ocular/",
    );
  });
});

describe("NovidadesSection -- publicações do blog", () => {
  it("mostra todas as publicações, mais recentes primeiro, num carrossel sem setas", async () => {
    listarPublicadas.mockResolvedValue([1, 2, 3, 4, 5].map((n) => publicacao(n)));
    render(
      <MemoryRouter>
        <NovidadesSection />
      </MemoryRouter>,
    );

    const primeira = await screen.findByRole("link", { name: /Publicação 1/ });
    expect(primeira).toHaveAttribute("href", "/publicacoes/publicacao-1");
    expect(within(primeira).getByText("Publicação")).toBeInTheDocument();
    expect(within(primeira).getByText("resumo 1")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Publicação 5/ })).toHaveAttribute("href", "/publicacoes/publicacao-5");
    expect(screen.getAllByRole("link")[0]).toBe(primeira);

    expect(screen.queryByRole("button", { name: /anterior|seguinte|previous|next/i })).not.toBeInTheDocument();
  });

  it("publicação só com vídeo usa o vídeo como miniatura", async () => {
    listarPublicadas.mockResolvedValue([
      publicacao(1, { midias: [{ id: "v", url: "https://cdn.test/publicacoes/p1/v.mp4", ordem: 1 }] }),
    ]);
    const { container } = render(
      <MemoryRouter>
        <NovidadesSection />
      </MemoryRouter>,
    );

    await screen.findByRole("link", { name: /Publicação 1/ });
    expect(container.querySelector("video")).toHaveAttribute("src", "https://cdn.test/publicacoes/p1/v.mp4#t=0.1");
  });

  it("sem API, ficam só os cartões fixos", async () => {
    listarPublicadas.mockRejectedValue(new Error("sem ligação"));
    render(
      <MemoryRouter>
        <NovidadesSection />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("link", { name: /Notícias sobre a Saúde Visual/i })).toBeInTheDocument();
    expect(listarPublicadas).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Publicação")).not.toBeInTheDocument();
  });
});
