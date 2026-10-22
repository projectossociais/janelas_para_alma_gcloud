import { describe, expect, it } from "vitest";
import { JANELA_TRACO, MOTIVOS, amostrarTraco, motivoFeito, nivelSamakaka, pontoDoTraco, resumirSamakaka } from "./samakaka";

describe("motivos", () => {
  it("seis motivos diferentes, todos dentro do quadrado", () => {
    expect(new Set(MOTIVOS.map((m) => m.id)).size).toBe(6);
    for (const m of MOTIVOS) for (const [x, y] of m.pontos()) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(1);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(1);
    }
  });
});

describe("níveis", () => {
  it("cada motivo um pouco mais difícil, até um mínimo", () => {
    expect(nivelSamakaka(0)).toEqual({ pontoMm: 2.2, contraste: 0.8, folgaMm: 4 });
    expect(nivelSamakaka(1).pontoMm).toBeLessThan(nivelSamakaka(0).pontoMm);
    expect(nivelSamakaka(20)).toEqual(nivelSamakaka(8));
    expect(nivelSamakaka(8).folgaMm).toBeGreaterThan(1);
  });
});

describe("seguir o traço", () => {
  const traco = amostrarTraco([[0, 0], [10, 0]], 1); // 11 pontos, de 1 em 1

  it("amostra o traço com o passo pedido, do primeiro ao último ponto", () => {
    expect(traco).toHaveLength(11);
    expect(traco[0]).toEqual([0, 0]);
    expect(traco[10]).toEqual([10, 0]);
  });

  it("encontra o ponto mais perto à frente, com a distância", () => {
    expect(pontoDoTraco(traco, 0, 4, 0.5)).toEqual({ indice: 4, distancia: 0.5 });
  });

  it("não salta para a frente além da janela", () => {
    const longo = amostrarTraco([[0, 0], [100, 0]], 1);
    expect(pontoDoTraco(longo, 0, 90, 0).indice).toBe(JANELA_TRACO);
  });

  it("num motivo fechado, tocar no fim (= início) logo no princípio não o acaba", () => {
    const losango = amostrarTraco(MOTIVOS[1].pontos(), 0.01);
    const [xf, yf] = losango[losango.length - 1];
    const { indice } = pontoDoTraco(losango, 0, xf, yf);
    expect(motivoFeito(losango, indice)).toBe(false);
  });

  it("feito quando chega ao penúltimo ponto", () => {
    expect(motivoFeito(traco, 9)).toBe(true);
    expect(motivoFeito(traco, 8)).toBe(false);
  });
});

describe("resumo", () => {
  it("média do afastamento, percentagem dentro e os pontinhos mais finos", () => {
    expect(resumirSamakaka([0.2, 0.4], 10, 1, 3)).toEqual({ motivos: 3, mediaMm: 0.3, dentroPct: 90, maisFinoMm: nivelSamakaka(2).pontoMm });
    expect(resumirSamakaka([], 0, 0, 0)).toEqual({ motivos: 0, mediaMm: null, dentroPct: null, maisFinoMm: null });
  });
});
