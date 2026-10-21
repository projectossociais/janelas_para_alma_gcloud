import { afterEach, describe, expect, it } from "vitest";
import {
  DELTA_ANULACAO,
  FUGA_MAX,
  PEDESTAL,
  amplitudeMaxima,
  canaisParaOlhos,
  coresAnulacao,
  coresEstereograma,
  guardarAfinacao,
  juntarOlhos,
  lerAfinacao,
  tabelaDosOlhos,
  oitoBitsParaLinear,
  type Afinacao,
  type Rgb,
} from "./anaglifo";

/** O que cada olho vê de uma cor do ecrã, pelo modelo de fuga. */
const visto = (cor: Rgb, af: Afinacao) => {
  const r = oitoBitsParaLinear(cor[0]);
  const g = oitoBitsParaLinear(cor[1]);
  return { esquerdo: r + af.fugaNoVermelho * g, direito: g + af.fugaNoCiano * r };
};

const OCULOS: Afinacao = { fugaNoVermelho: 0.12, fugaNoCiano: 0.08 };

describe("canaisParaOlhos", () => {
  it("sem fuga, cada canal é a luminância do seu olho", () => {
    expect(canaisParaOlhos(0.3, 0.7, { fugaNoVermelho: 0, fugaNoCiano: 0 })).toEqual({ r: 0.3, g: 0.7 });
  });

  it("descontada a fuga, cada olho vê exactamente o pretendido", () => {
    const { r, g } = canaisParaOlhos(0.2, 0.8, OCULOS);
    expect(r + OCULOS.fugaNoVermelho * g).toBeCloseTo(0.2, 10);
    expect(g + OCULOS.fugaNoCiano * r).toBeCloseTo(0.8, 10);
  });
});

describe("coresAnulacao", () => {
  it("o quadrado desaparece no olho direito quando o cursor iguala a fuga do filtro ciano", () => {
    const { fundo, quadrado } = coresAnulacao("direito", OCULOS.fugaNoCiano);
    // Tolerância: o ecrã só tem 256 níveis por canal.
    expect(visto(quadrado, OCULOS).direito).toBeCloseTo(visto(fundo, OCULOS).direito, 2);
    // ...e continua bem visível no olho esquerdo.
    expect(visto(quadrado, OCULOS).esquerdo - visto(fundo, OCULOS).esquerdo).toBeGreaterThan(0.2);
  });

  it("o mesmo para o olho esquerdo e a fuga do filtro vermelho", () => {
    const { fundo, quadrado } = coresAnulacao("esquerdo", OCULOS.fugaNoVermelho);
    expect(visto(quadrado, OCULOS).esquerdo).toBeCloseTo(visto(fundo, OCULOS).esquerdo, 2);
  });

  it("com o cursor no sítio errado, o quadrado vê-se", () => {
    const { fundo, quadrado } = coresAnulacao("direito", 0);
    expect(Math.abs(visto(quadrado, OCULOS).direito - visto(fundo, OCULOS).direito)).toBeGreaterThan(0.02);
  });

  it("o fundo é o pedestal cinzento e o quadrado sobe DELTA num canal", () => {
    const { fundo, quadrado } = coresAnulacao("direito", 0);
    expect(oitoBitsParaLinear(fundo[0])).toBeCloseTo(PEDESTAL, 2);
    expect(oitoBitsParaLinear(quadrado[0])).toBeCloseTo(PEDESTAL + DELTA_ANULACAO, 2);
  });

  it("o cursor nunca passa do máximo", () => {
    expect(coresAnulacao("direito", 9)).toEqual(coresAnulacao("direito", FUGA_MAX));
  });
});

describe("amplitudeMaxima", () => {
  it("sem fuga, a amplitude máxima", () => {
    expect(amplitudeMaxima({ fugaNoVermelho: 0, fugaNoCiano: 0 })).toBe(0.45);
  });

  it("mais fuga, menos amplitude -- e os canais cabem sempre", () => {
    const pouca = amplitudeMaxima({ fugaNoVermelho: 0.05, fugaNoCiano: 0.05 });
    const muita = amplitudeMaxima({ fugaNoVermelho: 0.3, fugaNoCiano: 0.3 });
    expect(muita).toBeLessThan(pouca);
    expect(muita).toBeGreaterThan(0);
  });
});

describe("coresEstereograma", () => {
  it("sem afinação, as cores puras de sempre", () => {
    expect(coresEstereograma(null)).toEqual([
      [0, 0, 0],
      [0, 255, 255],
      [255, 0, 0],
      [255, 255, 255],
    ]);
  });

  it("com afinação, cada olho deixa de ver o fantasma do outro", () => {
    const cores = coresEstereograma(OCULOS);
    // Índice (esquerdo << 1) | direito. Para o olho esquerdo, os pares que só
    // diferem no direito têm de parecer iguais (e vice-versa).
    const v = cores.map((c) => visto(c, OCULOS));
    expect(v[0].esquerdo).toBeCloseTo(v[1].esquerdo, 2);
    expect(v[2].esquerdo).toBeCloseTo(v[3].esquerdo, 2);
    expect(v[0].direito).toBeCloseTo(v[2].direito, 2);
    expect(v[1].direito).toBeCloseTo(v[3].direito, 2);
    // ...e continua a haver contraste em cada olho.
    expect(v[2].esquerdo - v[0].esquerdo).toBeGreaterThan(0.3);
    expect(v[1].direito - v[0].direito).toBeGreaterThan(0.3);
  });
});

describe("guardar por aparelho", () => {
  afterEach(() => window.localStorage.clear());

  it("guarda e lê", () => {
    guardarAfinacao(OCULOS);
    expect(lerAfinacao()).toEqual(OCULOS);
  });

  it("ignora valores inválidos", () => {
    window.localStorage.setItem("jpa.visao.oculos", JSON.stringify({ fugaNoVermelho: 2, fugaNoCiano: 0.1 }));
    expect(lerAfinacao()).toBeNull();
    window.localStorage.setItem("jpa.visao.oculos", "não é json");
    expect(lerAfinacao()).toBeNull();
  });
});

describe("tabelaDosOlhos / juntarOlhos", () => {
  it("sem afinação, cinzento esquerdo no vermelho e direito no verde e azul", () => {
    const t = tabelaDosOlhos(null);
    const i = ((200 << 8) | 30) * 3;
    expect([t[i], t[i + 1], t[i + 2]]).toEqual([200, 30, 30]);
  });

  it("com afinação, um elemento só do olho esquerdo não deixa fantasma no direito", () => {
    const t = tabelaDosOlhos(OCULOS);
    const cor = (e: number, d: number): Rgb => {
      const i = ((e << 8) | d) * 3;
      return [t[i], t[i + 1], t[i + 2]];
    };
    // Peixe só no olho esquerdo (escuro nesse olho, fundo branco no outro) vs fundo.
    const peixe = visto(cor(0, 255), OCULOS);
    const fundo = visto(cor(255, 255), OCULOS);
    expect(peixe.direito).toBeCloseTo(fundo.direito, 2);
    expect(fundo.esquerdo - peixe.esquerdo).toBeGreaterThan(0.3);
  });

  it("junta duas imagens RGBA numa", () => {
    const esq = new Uint8ClampedArray([10, 10, 10, 255, 250, 250, 250, 255]);
    const dir = new Uint8ClampedArray([200, 200, 200, 255, 0, 0, 0, 255]);
    const saida = new Uint8ClampedArray(8);
    juntarOlhos(esq, dir, saida, tabelaDosOlhos(null));
    expect(Array.from(saida)).toEqual([10, 200, 200, 255, 250, 0, 0, 255]);
  });
});
