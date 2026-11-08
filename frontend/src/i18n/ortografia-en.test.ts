import enUS from "./locales/en-US.json";

type Arvore = { [chave: string]: string | Arvore };

function folhas(arvore: Arvore, prefixo = ""): [string, string][] {
  return Object.entries(arvore).flatMap(([k, v]) => {
    const caminho = prefixo ? `${prefixo}.${k}` : k;
    return typeof v === "string" ? [[caminho, v] as [string, string]] : folhas(v, caminho);
  });
}

/**
 * O site inglês segue a ortografia americana (docs/glossario-pt-en.md:
 * Merriam-Webster; *color, behavior, center, canceled*). Grafias britânicas
 * já entraram por tradução e foram corrigidas a 2026-11-04 -- isto impede que
 * voltem. Se uma palavra daqui for mesmo precisa (ex.: um nome próprio),
 * acrescenta-se uma excepção explícita, nunca se apaga a regra.
 */
const BRITANICAS =
  /\b(colours?|coloured|favour\w*|behaviour\w*|honour\w*|neighbour\w*|centre[sd]?|(milli|centi|kilo)?metres?|litres?|programmes?|\w+is(e|ed|es|ing|ation)s?|travell\w*|cancell(ed|ing)|modell\w*|labell\w*|catalogue|licence|defence|practis\w*|whilst|amongst|towards|analys(e|ed|ing))\b/i;

// Palavras em "-ise" que também são correctas em inglês americano.
const ISE_AMERICANO = new Set(
  "advise advised advises advising exercise exercised exercises exercising promise promised promises raise raised raises raising rise rises otherwise wise surprise surprised surprises surprising premise concise precise praise praised noise paradise expertise franchise compromise enterprise enterprises revise revised revising supervise supervised supervising televise devise devised disguise despise merchandise demise improvise excise poise cruise bruise apprise comprise comprised comprises arise arises arising guise advertising".split(
    " ",
  ),
);

describe("en-US usa ortografia americana", () => {
  it("nenhum texto tem grafias britânicas", () => {
    const encontradas = folhas(enUS as Arvore).flatMap(([chave, texto]) =>
      [...texto.matchAll(new RegExp(BRITANICAS, "gi"))]
        .map((m) => m[0])
        .filter((palavra) => !ISE_AMERICANO.has(palavra.toLowerCase()))
        .map((palavra) => `${chave}: ${palavra}`),
    );
    expect(encontradas).toEqual([]);
  });
});
