import { describe, expect, it } from "vitest";
import { olhoTapado, resumirAgulha, vantagemDe } from "./agulha";

describe("o olho tapado", () => {
  it("alterna a cada tentativa, a começar pelo esquerdo", () => {
    expect([0, 1, 2, 3, 4].map(olhoTapado)).toEqual(["esquerdo", "direito", "esquerdo", "direito", "esquerdo"]);
  });
});

describe("vantagem dos dois olhos", () => {
  it("2 ou mais acertos a mais com os dois olhos: grande", () => {
    expect(vantagemDe(5, 1)).toBe("grande");
    expect(vantagemDe(4, 2)).toBe("grande");
  });

  it("1 a mais: pequena (repetir noutro dia)", () => {
    expect(vantagemDe(3, 2)).toBe("pequena");
  });

  it("igual ou pior com os dois olhos: nenhuma (para mostrar ao médico)", () => {
    expect(vantagemDe(3, 3)).toBe("nenhuma");
    expect(vantagemDe(1, 2)).toBe("nenhuma");
  });

  it("o resumo conta os acertos de cada condição", () => {
    expect(resumirAgulha({ dois: [true, true, false, true, true], um: [false, true, false, false, false] })).toEqual({
      acertosDois: 4,
      acertosUm: 1,
      vantagem: "grande",
    });
  });
});
