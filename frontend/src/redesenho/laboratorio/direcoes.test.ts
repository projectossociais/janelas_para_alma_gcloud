import { describe, expect, it } from "vitest";
import { DIRECCOES, contraste, type Tema } from "./direcoes";

// Tese do redesenho: a legibilidade é a marca. Nenhuma direcção pode ter texto
// abaixo do contraste AA (4,5:1), em nenhum dos temas.
const PARES = [
  ["tinta", "fundo"],
  ["tinta", "superficie"],
  ["tinta", "superficieAlt"],
  ["tintaSuave", "fundo"],
  ["tintaSuave", "superficie"],
  ["sobrePrimaria", "primaria"],
  ["sobreAcento", "acento"],
  ["primaria", "superficie"],
  ["sucesso", "superficie"],
  ["erro", "superficie"],
  ["erro", "fundo"],
] as const;

// O destaque só pinta títulos grandes (≥ 24 px): basta o limite AA de texto
// grande, 3:1.
describe("tokens das direcções: destaque legível nos títulos grandes", () => {
  for (const d of Object.values(DIRECCOES)) {
    for (const tema of ["claro", "escuro"] as Tema[]) {
      it(`${d.nome} · ${tema}`, () => {
        const c = d.cores[tema];
        expect(contraste(c.destaque, c.fundo)).toBeGreaterThanOrEqual(3);
      });
    }
  }
});

describe("tokens das direcções: contraste AA em todos os pares de texto", () => {
  for (const d of Object.values(DIRECCOES)) {
    for (const tema of ["claro", "escuro"] as Tema[]) {
      it(`${d.nome} · ${tema}`, () => {
        const c = d.cores[tema];
        const falhas = PARES.map(([t, f]) => [t, f, contraste(c[t], c[f])] as const)
          .filter(([, , r]) => r < 4.5)
          .map(([t, f, r]) => `${t}/${f} = ${r.toFixed(2)}`);
        expect(falhas).toEqual([]);
      });
    }
  }
});

// docs/PESQUISA_UX.md §3: transições de tarefa sem ressalto. Razão de
// amortecimento (massa 1) = damping / (2·√stiffness); abaixo de 0,9 nota-se.
describe("mola das direcções: amortecida, sem ressalto", () => {
  for (const d of Object.values(DIRECCOES)) {
    it(d.nome, () => {
      const razao = d.mola.damping / (2 * Math.sqrt(d.mola.stiffness));
      expect(razao).toBeGreaterThanOrEqual(0.9);
    });
  }
});
