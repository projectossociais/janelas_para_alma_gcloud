import { describe, expect, it } from "vitest";
import {
  diferencaEmLinhas,
  eAglomerada,
  mesmoTipoDaUltima,
  tipoDeAcuidade,
} from "./aglomeracao";

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
