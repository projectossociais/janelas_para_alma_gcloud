import indexHtml from "../../index.html?raw";
import { SITE } from "./rotas";

/**
 * As metatags sociais do index.html são o que o WhatsApp/Facebook/X lêem sem
 * correr JavaScript. Já apontaram para domínios mortos (janelasparaalma.org e
 * um subdomínio lovable.app); têm de usar o host canónico, o mesmo do SITE.
 */
const conteudo = (seletor: RegExp) => indexHtml.match(seletor)?.[1];

describe("index.html -- metatags sociais", () => {
  it("não há referências a domínios antigos", () => {
    expect(indexHtml).not.toMatch(/lovable\.app|janelasparaalma\.org/);
  });

  it("og:url, og:image e twitter:image usam o host canónico", () => {
    expect(conteudo(/property="og:url" content="([^"]+)"/)).toBe(`${SITE}/`);
    expect(conteudo(/property="og:image" content="([^"]+)"/)).toBe(`${SITE}/og-image.png`);
    expect(conteudo(/name="twitter:image" content="([^"]+)"/)).toBe(`${SITE}/og-image.png`);
  });

  it("todos os URLs absolutos do <head> são https://www.janelasparaalma.com (ou de terceiros conhecidos)", () => {
    const head = indexHtml.split("</head>")[0];
    const urls = [...head.matchAll(/https?:\/\/[^"'\s)]+/g)].map((m) => m[0]);
    const estranhos = urls.filter((u) => !u.startsWith(`${SITE}/`) && !/^https:\/\/fonts\.(googleapis|gstatic)\.com/.test(u));
    expect(estranhos).toEqual([]);
  });
});
