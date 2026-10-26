import { describe, it, expect } from "vitest";
import { agruparMilhares, detalhesDoDonativo, lerValorKz } from "./doacao";

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
