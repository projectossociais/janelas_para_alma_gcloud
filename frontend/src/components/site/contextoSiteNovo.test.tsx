import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isLoggedIn: false, user: null, logout: vi.fn(), isAdmin: false, loading: false }),
}));
vi.mock("@/contexts/ProfileContext", () => ({ useProfile: () => ({ profile: null }) }));
vi.mock("@/lib/apiClient", () => ({ bannerHomepageApi: { obterAtivo: () => Promise.resolve(null) } }));

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import { EstruturaSite } from "./EstruturaSite";
import { ContextoSiteNovo } from "./contextoSiteNovo";

/**
 * Transição do redesenho: uma página antiga dentro do `EstruturaSite` mostra
 * o cabeçalho e o rodapé novos, e nunca os dois (novo e antigo) ao mesmo tempo.
 */
describe("página antiga dentro do site novo", () => {
  it("só há um cabeçalho e um rodapé: os novos", () => {
    render(
      <MemoryRouter>
        <EstruturaSite>
          <Navbar />
          <BackButton />
          <p>Conteúdo antigo</p>
          <Footer />
        </EstruturaSite>
      </MemoryRouter>,
    );
    expect(screen.getByText("Conteúdo antigo")).toBeInTheDocument();
    expect(screen.getAllByRole("banner")).toHaveLength(1);
    expect(screen.getAllByRole("contentinfo")).toHaveLength(1);
  });

  it("o Navbar e o Footer antigos não desenham nada lá dentro, e desenham fora", () => {
    const dentro = render(
      <MemoryRouter>
        <ContextoSiteNovo.Provider value={true}>
          <Navbar />
          <Footer />
        </ContextoSiteNovo.Provider>
      </MemoryRouter>,
    );
    expect(dentro.container).toBeEmptyDOMElement();
    dentro.unmount();

    const fora = render(
      <MemoryRouter>
        <Navbar />
        <Footer />
      </MemoryRouter>,
    );
    expect(fora.container).not.toBeEmptyDOMElement();
  });

  it("o botão Voltar deixa de compensar o cabeçalho fixo antigo", () => {
    render(
      <MemoryRouter>
        <EstruturaSite>
          <BackButton />
        </EstruturaSite>
      </MemoryRouter>,
    );
    const contentor = screen.getAllByRole("button").find((b) => b.getAttribute("aria-label"))!.parentElement!;
    expect(contentor.className).toContain("pt-6");
    expect(contentor.className).not.toContain("pt-20");
  });
});

describe("páginas antigas embrulhadas no site novo", () => {
  // Uma página dentro do EstruturaSite já está dentro do <main> dele: um
  // segundo <main> lá dentro é uma violação de acessibilidade (landmarks).
  const fontes = import.meta.glob("/src/pages/*.tsx", { query: "?raw", import: "default", eager: true }) as Record<
    string,
    string
  >;
  const EMBRULHADAS = [
    "Sobre", "Equipa", "Kamba", "CampanhaGamek", "Publicacoes", "PublicacaoDetalhe", "Parceiros",
    "PortalClinicoOptioptika", "Tecnologia", "Circular", "Suporte", "Exercicios", "Apoiar",
    "PoliticaPrivacidade", "TermosUtilizacao", "Faq", "Impacto", "JunteSe",
  ];

  it.each(EMBRULHADAS)("%s não tem um <main> próprio", (pagina) => {
    const fonte = fontes[`/src/pages/${pagina}.tsx`];
    expect(fonte, pagina).toBeDefined();
    expect(fonte).not.toMatch(/<main[\s>]/);
  });
});
