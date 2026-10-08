import { describe, expect, it } from "vitest";
import { gerarOpiniaoPublico } from "./opiniaoPublico";

/** Uma sequência fixa de "aleatórios", a repetir. */
const sequencia = (...xs: number[]) => {
  let i = 0;
  return () => xs[i++ % xs.length];
};

describe("gerarOpiniaoPublico (jogo sem servidor)", () => {
  it("a certa fica entre 55% e 75% e a soma é sempre 100", () => {
    for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
      const o = gerarOpiniaoPublico("C", () => r);
      expect(o.C).toBeGreaterThanOrEqual(55);
      expect(o.C).toBeLessThanOrEqual(75);
      expect(o.A + o.B + o.C + o.D).toBe(100);
    }
  });

  it("nunca deixa uma opção a 0% ou negativa, mesmo com pesos muito desiguais (o extremo: 75% na certa e 25% por três)", () => {
    // Pesos desiguais e a certa no máximo (75%): só 25% para repartir por três.
    const casos = [sequencia(0.999, 0, 0, 0.99), sequencia(0.999, 0.99, 0, 0), sequencia(0.999, 0, 0.99, 0)];
    for (const aleatorio of casos) {
      const o = gerarOpiniaoPublico("A", aleatorio);
      for (const v of [o.B, o.C, o.D]) expect(v).toBeGreaterThanOrEqual(1);
      expect(o.A + o.B + o.C + o.D).toBe(100);
    }
  });

  it("em mil sorteios, nenhuma opção a 0% e a soma sempre 100", () => {
    let semente = 7;
    const pseudo = () => ((semente = (semente * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 1000; i++) {
      const certa = (["A", "B", "C", "D"] as const)[i % 4];
      const o = gerarOpiniaoPublico(certa, pseudo);
      expect(Object.values(o).every((v) => v >= 1)).toBe(true);
      expect(o.A + o.B + o.C + o.D).toBe(100);
    }
  });
});
