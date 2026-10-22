import { describe, expect, it } from "vitest";
import {
  DIRECCOES_E,
  direccaoAleatoriaE,
  direccaoDaFala,
  direccaoDoGesto,
  guardarDistanciaLonge,
  ladoDoEPx,
  lerDistanciaLonge,
  niveisPalancaLonge,
} from "./palancaLonge";

describe("tamanho do E a 3 metros", () => {
  it("6/60 (logMAR 1,0) mede ~43,6 mm; 6/6 (0,0) ~4,4 mm", () => {
    expect(ladoDoEPx(1.0, 3000, 1)).toBeCloseTo(43.6, 1);
    expect(ladoDoEPx(0.0, 3000, 1)).toBeCloseTo(4.36, 2);
  });

  it("num telemóvel (6 px/mm, ecrã de 360 px) cabem todos de 6/60 a 6/5", () => {
    const n = niveisPalancaLonge(3000, 6, 2, 360 * 0.85);
    expect(n[0]).toBe(1.0);
    expect(n[n.length - 1]).toBe(-0.1);
  });

  it("os tamanhos que não cabem ficam de fora", () => {
    const n = niveisPalancaLonge(3000, 6, 2, 150);
    expect(n[0]).toBeLessThan(1.0);
    for (const l of n) expect(ladoDoEPx(l, 3000, 6)).toBeLessThanOrEqual(150);
  });
});

describe("gesto do adulto", () => {
  it("deslizar para um lado dá essa direcção", () => {
    expect(direccaoDoGesto(80, 10)).toBe("direita");
    expect(direccaoDoGesto(-80, 10)).toBe("esquerda");
    expect(direccaoDoGesto(5, -70)).toBe("cima");
    expect(direccaoDoGesto(5, 70)).toBe("baixo");
  });

  it("um toque sem deslizar, ou sem coordenadas, não é resposta", () => {
    expect(direccaoDoGesto(10, 12)).toBeNull();
    expect(direccaoDoGesto(NaN, NaN)).toBeNull();
  });

  it("a direcção seguinte nunca é igual à anterior", () => {
    for (const d of DIRECCOES_E) for (const r of [0, 0.5, 0.99]) expect(direccaoAleatoriaE(d, () => r)).not.toBe(d);
  });
});

describe("resposta em voz alta", () => {
  it("percebe a direcção numa frase curta, com ou sem acentos", () => {
    expect(direccaoDaFala("para cima")).toBe("cima");
    expect(direccaoDaFala("Baixo")).toBe("baixo");
    expect(direccaoDaFala("é para a esquerda")).toBe("esquerda");
    expect(direccaoDaFala("direita")).toBe("direita");
    expect(direccaoDaFala("left")).toBe("esquerda");
  });

  it("'não sei' é uma resposta", () => {
    expect(direccaoDaFala("não sei")).toBe("naosabe");
    expect(direccaoDaFala("nao vejo")).toBe("naosabe");
  });

  it("duas direcções ou nenhuma: não decide", () => {
    expect(direccaoDaFala("cima não baixo")).toBeNull();
    expect(direccaoDaFala("olá")).toBeNull();
  });
});

describe("distância guardada", () => {
  it("3 m por omissão; 2 m quando escolhido", () => {
    window.localStorage.clear();
    expect(lerDistanciaLonge()).toBe(3000);
    guardarDistanciaLonge(2000);
    expect(lerDistanciaLonge()).toBe(2000);
    window.localStorage.clear();
  });
});
