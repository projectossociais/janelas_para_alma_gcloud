import { describe, expect, it } from "vitest";
import { IRIS_RAIO_MM, analisarReflexos, desvioMaximo, desvioPeloTapar, limitarAIris } from "./luzOlhos";

const centro = { x: 0, y: 0 };

describe("reflexo da luz (Hirschberg)", () => {
  it("os dois reflexos no mesmo sítio: sem desvio", () => {
    expect(analisarReflexos({ direito: centro, esquerdo: centro })).toEqual([]);
    // O pequeno desvio natural para o nariz, igual nos dois olhos, não conta.
    expect(analisarReflexos({ direito: { x: 0.4, y: 0 }, esquerdo: { x: -0.4, y: 0 } })).toEqual([]);
  });

  it("reflexo do olho esquerdo 1,5 mm para a orelha: olho esquerdo virado para dentro, ~25 Δ", () => {
    // De frente, a orelha esquerda da criança fica à direita do adulto (+x).
    const a = analisarReflexos({ direito: centro, esquerdo: { x: 1.5, y: 0 } });
    expect(a).toEqual([{ olho: "esquerdo", sentido: "dentro", mm: 1.5, delta: 25 }]);
  });

  it("reflexo do olho direito para o nariz: olho direito virado para fora", () => {
    const a = analisarReflexos({ direito: { x: 1, y: 0 }, esquerdo: centro });
    expect(a).toEqual([{ olho: "direito", sentido: "fora", mm: 1, delta: 15 }]);
  });

  it("reflexo para baixo: olho virado para cima", () => {
    const a = analisarReflexos({ direito: centro, esquerdo: { x: 0, y: 1 } });
    expect(a).toEqual([{ olho: "esquerdo", sentido: "cima", mm: 1, delta: 15 }]);
  });

  it("menos de meio milímetro não se distingue a olho", () => {
    expect(analisarReflexos({ direito: centro, esquerdo: { x: 0.3, y: 0.2 } })).toEqual([]);
  });

  it("o desvio máximo é o maior dos achados", () => {
    const a = analisarReflexos({ direito: centro, esquerdo: { x: 2, y: 1 } });
    expect(desvioMaximo(a)).toBe(30);
    expect(desvioMaximo([])).toBe(0);
  });

  it("um reflexo marcado fora da íris fica na borda", () => {
    const r = limitarAIris({ x: 12, y: 0 });
    expect(r.x).toBe(IRIS_RAIO_MM);
  });
});

describe("teste de tapar", () => {
  it("o olho que se mexe para o nariz estava virado para fora", () => {
    expect(desvioPeloTapar({ esquerdo: "dentro", direito: "nao" })).toEqual([{ olho: "esquerdo", sentido: "fora" }]);
  });

  it("para a orelha: estava virado para dentro; para cima: estava para baixo", () => {
    expect(desvioPeloTapar({ direito: "fora", esquerdo: "cima" })).toEqual([
      { olho: "direito", sentido: "dentro" },
      { olho: "esquerdo", sentido: "baixo" },
    ]);
  });

  it("'não se mexeu' e 'não consegui ver' não são desvio", () => {
    expect(desvioPeloTapar({ direito: "nao", esquerdo: "naovi" })).toEqual([]);
  });
});
