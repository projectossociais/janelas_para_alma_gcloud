/**
 * Gera dist/sitemap.xml a partir do mapa de rotas (src/i18n/rotas.ts).
 * Corre depois do `vite build` (ver "build" no package.json).
 *
 * - Com VITE_ENABLE_EN=true: cada página bilingue aparece nos dois idiomas,
 *   com as alternativas xhtml:link (pt-AO, en-US, x-default), recíprocas.
 * - Sem a flag: só as páginas portuguesas, sem alternativas -- nunca se
 *   anunciam URLs /en/... que dariam 404.
 * - Ficam de fora páginas `foraDoSitemap` (conta, fluxos, resultados) e
 *   rotas com parâmetros (publicações: dependem da API).
 *
 * O mapa é lido como texto (importá-lo em Node arrastaria React Router e o
 * i18next); src/i18n/sitemap.test.ts garante que esta leitura coincide com
 * ROTAS_SITEMAP.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Host final de produção: https://janelasparaalma.com responde 308 para o www,
// e canonical/hreflang/sitemap têm de apontar para o URL final, não para um
// redireccionamento.
export const SITE = "https://www.janelasparaalma.com";

export function lerRotas(texto) {
  const rotas = [];
  for (const m of texto.matchAll(/\{\s*chave:\s*"(\w+)",\s*pt:\s*"([^"]+)",\s*en:\s*"([^"]+)"([^}]*)\}/g)) {
    rotas.push({
      chave: m[1],
      pt: m[2],
      en: m[3],
      apenasPt: /apenasPt:\s*true/.test(m[4]),
      foraDoSitemap: /foraDoSitemap:\s*true/.test(m[4]),
    });
  }
  return rotas;
}

export function gerarSitemap(rotas, enAtivo) {
  const url = (loc, alternativas) =>
    [
      "  <url>",
      `    <loc>${loc}</loc>`,
      ...alternativas.map(([lang, href]) => `    <xhtml:link rel="alternate" hreflang="${lang}" href="${href}"/>`),
      "  </url>",
    ].join("\n");

  const entradas = [];
  for (const r of rotas.filter((r) => !r.foraDoSitemap && !r.pt.includes(":"))) {
    const pt = SITE + r.pt;
    if (!enAtivo || r.apenasPt) {
      entradas.push(url(pt, []));
      continue;
    }
    const en = SITE + r.en;
    const alternativas = [["pt-AO", pt], ["en-US", en], ["x-default", pt]];
    entradas.push(url(pt, alternativas), url(en, alternativas));
  }
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...entradas,
    "</urlset>",
    "",
  ].join("\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
  const rotas = lerRotas(readFileSync(join(raiz, "src/i18n/rotas.ts"), "utf8"));
  const enAtivo = process.env.VITE_ENABLE_EN === "true";
  const destino = join(raiz, "dist");
  if (!existsSync(destino)) throw new Error("dist/ não existe: correr depois do vite build");
  writeFileSync(join(destino, "sitemap.xml"), gerarSitemap(rotas, enAtivo));
  console.log(`dist/sitemap.xml: ${rotas.length} rotas no mapa, inglês ${enAtivo ? "ligado" : "desligado"}`);
}
