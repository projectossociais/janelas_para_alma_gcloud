import {
  DEGRAUS_TESTE_CONTRASTE,
  DEGRAUS_TREINO_CONTRASTE,
  cinzentoParaContraste,
  contrasteDoCinzento,
  degrausMostraveis,
  linearParaSrgb,
  sensibilidade,
  srgbParaLinear,
} from "./contraste";

describe("contraste", () => {
  it("sRGB <-> linear são inversas", () => {
    for (const x of [0, 0.01, 0.2, 0.5, 0.9, 1]) expect(linearParaSrgb(srgbParaLinear(x))).toBeCloseTo(x, 9);
  });

  it("100% de contraste é preto; 0% é branco", () => {
    expect(cinzentoParaContraste(1)).toBe(0);
    expect(cinzentoParaContraste(0)).toBe(255);
  });

  it("50% de contraste não é cinzento 128: a conversão é em luminância linear", () => {
    // luminância 0,5 -> sRGB 0,735 -> 188
    expect(cinzentoParaContraste(0.5)).toBe(188);
    expect(contrasteDoCinzento(188)).toBeCloseTo(0.5, 2);
  });

  it("o degrau mais baixo que um ecrã de 8 bits mostra é ~0,9% (cinzento 254)", () => {
    expect(contrasteDoCinzento(254)).toBeCloseTo(0.0089, 4);
  });

  it("os degraus do teste que ficam são todos mostráveis, distintos e decrescentes", () => {
    const d = degrausMostraveis(DEGRAUS_TESTE_CONTRASTE);
    expect(d.length).toBeGreaterThanOrEqual(7);
    for (let i = 1; i < d.length; i++) {
      expect(d[i].cinzento).toBeGreaterThan(d[i - 1].cinzento);
      expect(d[i].real).toBeLessThan(d[i - 1].real);
    }
    for (const x of d) {
      expect(x.cinzento).toBeLessThan(255);
      expect(Math.abs(x.real - x.pedido) / x.pedido).toBeLessThanOrEqual(0.25);
    }
  });

  it("no treino descarta degraus que coincidem no mesmo cinzento", () => {
    const d = degrausMostraveis(DEGRAUS_TREINO_CONTRASTE);
    expect(new Set(d.map((x) => x.cinzento)).size).toBe(d.length);
    expect(d.length).toBeLessThan(DEGRAUS_TREINO_CONTRASTE.length);
  });

  it("sensibilidade = -log10(contraste)", () => {
    expect(sensibilidade(1)).toBe(0);
    expect(sensibilidade(0.01)).toBe(2);
    expect(sensibilidade(0.0316)).toBe(1.5);
  });
});
