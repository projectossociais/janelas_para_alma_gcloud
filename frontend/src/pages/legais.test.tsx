import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PoliticaPrivacidade from "./PoliticaPrivacidade";
import TermosUtilizacao from "./TermosUtilizacao";
import { violacoesAcessibilidade } from "@/design/testes/acessibilidade";

// As páginas legais no arquétipo Documento (docs/LAYOUTS.md §2.6): o texto não
// muda, lê-se melhor -- um h1, secções numeradas e um índice que leva a cada uma.

const abrir = (Pagina: () => JSX.Element) =>
  render(
    <MemoryRouter>
      <Pagina />
    </MemoryRouter>,
  );

describe.each([
  ["Política de Privacidade", PoliticaPrivacidade, 13],
  ["Termos de Utilização", TermosUtilizacao, 9],
])("%s", (_nome, Pagina, n) => {
  it(`tem um só h1 e ${n} secções numeradas`, () => {
    abrir(Pagina);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    const titulos = screen.getAllByRole("heading", { level: 2 });
    expect(titulos).toHaveLength(n);
    titulos.forEach((h, i) => expect(h.textContent).toMatch(new RegExp(`^${i + 1}\\.`)));
  });

  it("o índice leva a cada secção", () => {
    abrir(Pagina);
    const indice = screen.getByRole("navigation", { name: "Nesta página" });
    const ligacoes = within(indice).getAllByRole("link");
    expect(ligacoes).toHaveLength(n);
    for (const l of ligacoes) {
      const alvo = l.getAttribute("href")?.slice(1) ?? "";
      expect(document.getElementById(alvo)).not.toBeNull();
    }
  });

  it("sem violações de acessibilidade", async () => {
    const { container } = abrir(Pagina);
    expect(await violacoesAcessibilidade(container)).toEqual([]);
  });
});
