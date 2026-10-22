import { describe, expect, it } from "vitest";
import {
  LADO_COM_BARRAS,
  LADO_MAX_COM_BARRAS_PX,
  barrasDeFlom,
  diferencaEmLinhas,
  eAglomerada,
  levaBarras,
  mesmoTipoDaUltima,
  tipoDeAcuidade,
} from "./aglomeracao";

describe("barras de Flom", () => {
  it("o conjunto mede 9 aberturas", () => {
    expect(LADO_COM_BARRAS).toBe(9);
  });

  it("quatro barras com a espessura do traço, a 1 traço do anel, dentro do conjunto", () => {
    const barras = barrasDeFlom();
    expect(barras).toHaveLength(4);
    for (const b of barras) {
      expect(Math.min(b.largura, b.altura)).toBe(1);
      expect(Math.max(b.largura, b.altura)).toBe(5);
      // Dentro do quadrado de lado 9 centrado no anel.
      expect(b.x).toBeGreaterThanOrEqual(-4.5);
      expect(b.y).toBeGreaterThanOrEqual(-4.5);
      expect(b.x + b.largura).toBeLessThanOrEqual(4.5);
      expect(b.y + b.altura).toBeLessThanOrEqual(4.5);
    }
    // A barra de cima começa a 1 traço do anel (raio exterior 2,5 -> 3,5).
    const cima = barras[0];
    expect(cima.y + cima.altura).toBe(-3.5);
    const direita = barras[3];
    expect(direita.x).toBe(3.5);
  });

  it("os anéis grandes demais para o palco ficam sem barras", () => {
    expect(levaBarras(LADO_MAX_COM_BARRAS_PX / 9)).toBe(true);
    expect(levaBarras(LADO_MAX_COM_BARRAS_PX / 9 + 1)).toBe(false);
  });
});

describe("diferencaEmLinhas", () => {
  it("0,1 logMAR por linha", () => {
    expect(diferencaEmLinhas(0.5, 0.3)).toBe(2);
    expect(diferencaEmLinhas(0.1, 0.1)).toBe(0);
    expect(diferencaEmLinhas(0.0, 0.3)).toBe(3);
  });

  it("arredonda à linha mais próxima (limiares finos, anel a anel)", () => {
    expect(diferencaEmLinhas(0.57, 0.63)).toBe(1);
    expect(diferencaEmLinhas(0.32, 0.18)).toBe(1);
  });

  it("sem um dos olhos, não há diferença", () => {
    expect(diferencaEmLinhas(null, 0.2)).toBeNull();
  });
});

describe("mesmoTipoDaUltima", () => {
  const s = (dia: number, aglomeracao?: boolean) => ({
    created_at: `2026-10-${String(dia).padStart(2, "0")}T10:00:00Z`,
    sinais: aglomeracao === undefined ? {} : { aglomeracao },
  });

  it("depois da mudança, só as sessões com barras", () => {
    const sessoes = [s(1), s(5), s(20, true), s(21, true)];
    expect(mesmoTipoDaUltima(sessoes).map((x) => x.created_at.slice(8, 10))).toEqual(["20", "21"]);
  });

  it("sem sessões com barras, fica tudo como estava", () => {
    const sessoes = [s(1), s(5)];
    expect(mesmoTipoDaUltima(sessoes)).toHaveLength(2);
  });

  it("sem sessões, vazio", () => {
    expect(mesmoTipoDaUltima([])).toEqual([]);
  });

  it("ao longe (mãozinha a 3 m) é outro tipo: não se compara com as de perto", () => {
    const longe = (dia: number) => ({ created_at: `2026-10-${dia}T10:00:00Z`, sinais: { ao_longe: true } });
    const sessoes = [s(10, true), s(15, true), longe(21), longe(22)];
    expect(mesmoTipoDaUltima(sessoes).map((x) => x.created_at.slice(8, 10))).toEqual(["21", "22"]);
    expect(tipoDeAcuidade(longe(21))).toBe("longe");
    expect(tipoDeAcuidade(s(1, true))).toBe("barras");
    expect(tipoDeAcuidade(s(1))).toBe("isolado");
  });

  it("eAglomerada só com o sinal explícito", () => {
    expect(eAglomerada(s(1, true))).toBe(true);
    expect(eAglomerada({ created_at: "x", sinais: null })).toBe(false);
  });
});
