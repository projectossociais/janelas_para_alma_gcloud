import { describe, expect, it } from "vitest";
import { contraste } from "../contraste";
import { MARCA } from "./marca";

// Os factos de contraste por trás das regras de uso de docs/MARCA.md §3.
// Se alguém mudar uma cor da marca, estas regras têm de ser revistas.
describe("cores da marca: regras de uso", () => {
  const branco = "#FFFFFF";

  it("azul e marinho servem para texto e botões sobre branco (AA)", () => {
    expect(contraste(MARCA.azul, branco)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(MARCA.marinho, branco)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(MARCA.verde, branco)).toBeGreaterThanOrEqual(4.5);
  });

  it("turquesa, dourado e lima nunca são texto sobre fundo claro", () => {
    expect(contraste(MARCA.turquesa, branco)).toBeLessThan(3);
    expect(contraste(MARCA.dourado, branco)).toBeLessThan(3);
    expect(contraste(MARCA.lima, branco)).toBeLessThan(3);
  });

  it("turquesa, dourado e lima funcionam como fundo com texto marinho, ou como texto sobre marinho", () => {
    for (const cor of [MARCA.turquesa, MARCA.dourado, MARCA.lima, MARCA.azulClaro]) {
      expect(contraste(cor, MARCA.marinho)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
