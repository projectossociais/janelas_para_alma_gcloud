import { describe, expect, it } from "vitest";
import { afastamentoDoAlvoCm, calibrar, calibracaoPassaV1, deltaDeGraus } from "./calibracao";

describe("calibração V1 (método de Pundlik)", () => {
  it("converte graus em Δ (100 × tangente)", () => {
    expect(deltaDeGraus(0)).toBe(0);
    expect(deltaDeGraus(45)).toBeCloseTo(100, 9);
    expect(deltaDeGraus(10)).toBeCloseTo(17.633, 3);
  });

  it("diz a que distância pôr os alvos: a 40 cm, 10° fica a 7,05 cm", () => {
    expect(afastamentoDoAlvoCm(10, 40)).toBeCloseTo(7.053, 3);
  });

  it("recupera o factor de Hirschberg e o kappa de medições exactas", () => {
    const fator = 21;
    const kappa = 0.45;
    const pontos = [-15, -10, -5, 0, 5, 10, 15].map((g) => ({
      anguloGraus: g,
      descentracaoMm: kappa - deltaDeGraus(g) / fator,
    }));
    const r = calibrar(pontos);
    expect(r.ok).toBe(true);
    if (r.ok === false) return;
    expect(r.valor.fatorDeltaPorMm).toBeCloseTo(21, 6);
    expect(r.valor.descentracaoNaCameraMm).toBeCloseTo(0.45, 6);
    expect(r.valor.r2).toBeCloseTo(1, 9);
    expect(calibracaoPassaV1(r.valor)).toBe(true);
  });

  it("um factor fora de 19–23 Δ/mm não passa a V1", () => {
    const pontos = [0, 5, 10].map((g) => ({ anguloGraus: g, descentracaoMm: deltaDeGraus(g) / 30 }));
    const r = calibrar(pontos);
    expect(r.ok && calibracaoPassaV1(r.valor)).toBe(false);
  });

  it("com menos de três ângulos diferentes não se calibra", () => {
    expect(calibrar([{ anguloGraus: 0, descentracaoMm: 0.4 }, { anguloGraus: 5, descentracaoMm: 0.2 }])).toEqual({
      ok: false,
      motivo: "poucos-angulos",
    });
  });
});
