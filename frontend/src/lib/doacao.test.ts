import { describe, it, expect } from "vitest";
import { agruparMilhares, detalhesDoDonativo, frequenciaDoModo, lerValorKz, VALORES_DOACAO_KZ } from "./doacao";

describe("agruparMilhares", () => {
  it("agrupa com ponto, também abaixo de 10.000", () => {
    expect(agruparMilhares(5_000)).toBe("5.000");
    expect(agruparMilhares(250_000)).toBe("250.000");
    expect(agruparMilhares(1_234_567)).toBe("1.234.567");
    expect(agruparMilhares(900)).toBe("900");
  });
});

describe("lerValorKz", () => {
  it("aceita números com ou sem separadores de milhares", () => {
    expect(lerValorKz("25000")).toBe(25_000);
    expect(lerValorKz("25.000")).toBe(25_000);
    expect(lerValorKz(" 25 000 ")).toBe(25_000);
  });

  it("recusa vazio, zero, decimais, negativos e texto", () => {
    for (const texto of ["", "0", "12,5", "-500", "abc", "1e5", "1234567890"]) {
      expect(lerValorKz(texto)).toBeNull();
    }
  });
});

describe("detalhesDoDonativo", () => {
  it("junta frequência, valor, método e a nota", () => {
    expect(
      detalhesDoDonativo({ frequencia: "Mensal", valorKz: 25_000, metodo: "Multicaixa Express", nota: " para as crianças " }),
    ).toBe("Mensal · 25.000 Kz · Multicaixa Express · para as crianças");
  });

  it("sem nota, não deixa separador a mais", () => {
    expect(detalhesDoDonativo({ frequencia: "Uma única vez", valorKz: 5_000, metodo: "BAI", nota: "  " })).toBe(
      "Uma única vez · 5.000 Kz · BAI",
    );
  });
});

describe("valores sugeridos", () => {
  it("são diferentes para uma vez e para mensal, e o mensal começa mais baixo", () => {
    expect(VALORES_DOACAO_KZ.unica).not.toEqual(VALORES_DOACAO_KZ.mensal);
    expect(Math.min(...VALORES_DOACAO_KZ.mensal)).toBeLessThan(Math.min(...VALORES_DOACAO_KZ.unica));
    expect(Math.max(...VALORES_DOACAO_KZ.mensal)).toBeLessThan(Math.max(...VALORES_DOACAO_KZ.unica));
  });
});

describe("frequenciaDoModo", () => {
  it("lê só os dois modos conhecidos", () => {
    expect(frequenciaDoModo("mensal")).toBe("mensal");
    expect(frequenciaDoModo("unica")).toBe("unica");
    expect(frequenciaDoModo("semanal")).toBeNull();
    expect(frequenciaDoModo(null)).toBeNull();
  });
});
