import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { contraste } from "./contraste";
import { CORES, NOMES_COR, gerarCss, type NomeCor, type Tema } from "./tokens";

const TEMAS: Tema[] = ["claro", "escuro"];

describe("tokens.css", () => {
  it("está em dia com tokens.ts (correr `npm run tokens` se falhar)", () => {
    const css = readFileSync(resolve(process.cwd(), "src/design/tokens.css"), "utf8");
    expect(css.replace(/\r\n/g, "\n")).toBe(gerarCss());
  });

  it("cada tema define todas as cores", () => {
    for (const tema of TEMAS) {
      expect(Object.keys(CORES[tema]).sort()).toEqual([...NOMES_COR].sort());
    }
  });
});

// Texto: WCAG AA 4,5:1 (1.4.3). [texto, fundo]
const TEXTO: [NomeCor, NomeCor][] = [
  ["tinta", "fundo"],
  ["tinta", "superficie"],
  ["tinta", "superficie-alt"],
  ["tinta", "superficie-elevada"],
  ["tinta-suave", "fundo"],
  ["tinta-suave", "superficie"],
  ["tinta-suave", "superficie-alt"],
  ["accao", "fundo"],
  ["accao", "superficie"],
  ["accao", "accao-suave"],
  ["sobre-accao", "accao"],
  ["sobre-accao", "accao-forte"],
  ["sobre-acento", "acento"],
  ["sucesso", "superficie"],
  ["sucesso", "sucesso-suave"],
  ["aviso", "aviso-suave"],
  ["aviso", "superficie"],
  ["erro", "superficie"],
  ["erro", "fundo"],
  ["erro", "erro-suave"],
  ["sobre-erro", "erro"],
  // Texto dos avisos sobre os fundos de estado
  ["tinta", "accao-suave"],
  ["tinta-suave", "accao-suave"],
  ["tinta", "sucesso-suave"],
  ["tinta-suave", "sucesso-suave"],
  ["tinta", "aviso-suave"],
  ["tinta-suave", "aviso-suave"],
  ["tinta", "erro-suave"],
  ["tinta-suave", "erro-suave"],
];

// Componentes e foco: WCAG 3:1 (1.4.11, 2.4.13). [elemento, fundo]
const NAO_TEXTO: [NomeCor, NomeCor][] = [
  ["linha-forte", "fundo"],
  ["linha-forte", "superficie"],
  ["foco", "fundo"],
  ["foco", "superficie"],
  ["accao", "fundo"],
];

// O destaque só pinta títulos grandes (≥ 24 px): texto grande, 3:1.
const TEXTO_GRANDE: [NomeCor, NomeCor][] = [
  ["destaque", "fundo"],
  ["destaque", "superficie"],
];

const falhas = (tema: Tema, pares: [NomeCor, NomeCor][], minimo: number) =>
  pares
    .map(([a, b]) => [a, b, contraste(CORES[tema][a], CORES[tema][b])] as const)
    .filter(([, , r]) => r < minimo)
    .map(([a, b, r]) => `${a}/${b} = ${r.toFixed(2)}`);

describe("tokens: contraste", () => {
  for (const tema of TEMAS) {
    it(`${tema}: texto ≥ 4,5:1`, () => expect(falhas(tema, TEXTO, 4.5)).toEqual([]));
    it(`${tema}: contornos de controlo, foco e acento ≥ 3:1`, () =>
      expect(falhas(tema, NAO_TEXTO, 3)).toEqual([]));
    it(`${tema}: destaque em títulos grandes ≥ 3:1`, () => expect(falhas(tema, TEXTO_GRANDE, 3)).toEqual([]));
  }
});

// Suave aos olhos (PESQUISA_UX §3, Conforto visual).
describe("tokens: conforto visual", () => {
  const TECTO: Record<Tema, number> = { claro: 16, escuro: 15 };
  for (const tema of TEMAS) {
    it(`${tema}: texto principal entre 7:1 e ${TECTO[tema]}:1, sem preto nem branco puros`, () => {
      const c = CORES[tema];
      const r = contraste(c.tinta, c.fundo);
      expect(r).toBeGreaterThanOrEqual(7);
      expect(r).toBeLessThanOrEqual(TECTO[tema]);
      expect(["#000000", "#FFFFFF"]).not.toContain(c.tinta.toUpperCase());
      expect(["#000000", "#FFFFFF"]).not.toContain(c.fundo.toUpperCase());
    });
  }

  it("no claro, o turquesa (acento) não chega a 3:1: só decorativo ou fundo com texto sobre-acento, nunca o único sinal de um estado", () => {
    expect(contraste(CORES.claro.acento, CORES.claro.superficie)).toBeLessThan(3);
    expect(contraste(CORES.claro["sobre-acento"], CORES.claro.acento)).toBeGreaterThanOrEqual(4.5);
  });

  it("a linha decorativa é discreta (menos de 1,5:1 com a superfície): separa sem riscar", () => {
    for (const tema of TEMAS) {
      expect(contraste(CORES[tema].linha, CORES[tema].superficie)).toBeLessThan(1.5);
    }
  });
});
