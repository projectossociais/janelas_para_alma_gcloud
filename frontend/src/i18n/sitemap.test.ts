import textoRotas from "./rotas.ts?raw";
import { ROTAS, ROTAS_SITEMAP } from "./rotas";
import { gerarSitemap, lerRotas } from "../../scripts/gerar-sitemap.mjs";

const rotas = lerRotas(textoRotas);

/** { loc -> alternativas } a partir do XML. */
function entradas(xml: string) {
  const out = new Map<string, string[]>();
  for (const bloco of xml.split("<url>").slice(1)) {
    const loc = bloco.match(/<loc>([^<]+)<\/loc>/)![1];
    out.set(loc, [...bloco.matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => `${m[1]} ${m[2]}`));
  }
  return out;
}

describe("sitemap.xml", () => {
  it("o script lê o mapa de rotas exactamente como a aplicação o vê", () => {
    expect(rotas.map((r: { chave: string }) => r.chave)).toEqual(ROTAS.map((r) => r.chave));
    const noSitemap = rotas.filter((r: { foraDoSitemap: boolean; pt: string }) => !r.foraDoSitemap && !r.pt.includes(":"));
    expect(noSitemap.map((r: { pt: string }) => r.pt)).toEqual(ROTAS_SITEMAP.map((r) => r.pt));
  });

  it("com a versão inglesa: páginas bilingues nos dois idiomas, alternativas recíprocas e completas", () => {
    const mapa = entradas(gerarSitemap(rotas, true));
    expect(mapa.get("https://www.janelasparaalma.com/faq")).toEqual([
      "pt-AO https://www.janelasparaalma.com/faq",
      "en-US https://www.janelasparaalma.com/en/faq",
      "x-default https://www.janelasparaalma.com/faq",
    ]);
    for (const [loc, alternativas] of mapa) {
      for (const alt of alternativas) {
        const href = alt.split(" ")[1];
        // cada alternativa é ela própria uma entrada, com o mesmo conjunto (reciprocidade)
        expect(mapa.has(href), `${loc} -> ${href}`).toBe(true);
        expect(mapa.get(href)).toEqual(alternativas);
      }
    }
  });

  it("o jogo (só PT) aparece só em português e sem alternativas", () => {
    const mapa = entradas(gerarSitemap(rotas, true));
    expect(mapa.get("https://www.janelasparaalma.com/jogo-curiosidades")).toEqual([]);
    expect([...mapa.keys()].some((l) => l.includes("trivia-game"))).toBe(false);
  });

  it("sem a versão inglesa: nenhum URL /en nem alternativas", () => {
    const xml = gerarSitemap(rotas, false);
    expect(xml).not.toMatch(/\/en[/"<]/);
    expect(xml).not.toContain("xhtml:link");
    expect(entradas(xml).has("https://www.janelasparaalma.com/politica-de-privacidade")).toBe(true);
  });

  it("páginas de conta e fluxos ficam de fora", () => {
    const locs = [...entradas(gerarSitemap(rotas, true)).keys()];
    for (const fora of ["/login", "/configuracoes", "/dashboard", "/scanner/resultados", "/en/settings"]) {
      expect(locs).not.toContain(`https://www.janelasparaalma.com${fora}`);
    }
  });
});
