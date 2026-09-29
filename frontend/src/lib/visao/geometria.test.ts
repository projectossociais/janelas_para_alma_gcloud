import {
  NIVEIS_TESTE_ACUIDADE,
  NIVEIS_TREINO_ACUIDADE,
  aberturaPx,
  arcminParaMm,
  arcsegParaPx,
  desenhavel,
  fraccao6,
  logmarParaDecimal,
  logmarParaDenominador6,
  niveisDesenhaveis,
} from "./geometria";
import { PX_POR_MM_NOMINAL, pxPorMmDaLarguraDoCartao } from "./calibracao";

describe("geometria", () => {
  it("1 minuto de arco a 6 m mede ~1,745 mm (optótipo 6/6)", () => {
    expect(arcminParaMm(1, 6000)).toBeCloseTo(1.7453, 3);
  });

  it("a 600 mm, logMAR 0 dá uma abertura de ~0,1745 mm", () => {
    expect(aberturaPx(0, 600, 1)).toBeCloseTo(0.17453, 4);
  });

  it("logMAR 1,0 é 10 vezes maior do que logMAR 0", () => {
    expect(aberturaPx(1, 600, 5) / aberturaPx(0, 600, 5)).toBeCloseTo(10, 3); // tan() quase linear em ângulos pequenos
  });

  it("segundos de arco para píxeis: 800\" a 600 mm com 4 px/mm", () => {
    // 600 * tan(800/206265) * 4 = 9,31 px
    expect(arcsegParaPx(800, 600, 4)).toBeCloseTo(9.308, 2);
  });

  it("níveis do teste: 1,0 a -0,1 em passos de 0,1, sem erros de vírgula flutuante", () => {
    expect(NIVEIS_TESTE_ACUIDADE).toEqual([1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0, -0.1]);
    expect(NIVEIS_TREINO_ACUIDADE).toHaveLength(23);
    expect(NIVEIS_TREINO_ACUIDADE[1]).toBe(0.95);
  });

  it("desenhável só a partir de 1,4 px de dispositivo", () => {
    expect(desenhavel(0.7, 2)).toBe(true);
    expect(desenhavel(0.69, 2)).toBe(false);
    expect(desenhavel(1.4, 1)).toBe(true);
  });

  it("descarta os níveis mais pequenos num ecrã de baixa densidade", () => {
    // 3,78 px/mm (nominal), 600 mm, DPR 1: logMAR 0,3 -> 1,32 px (descartado)
    const n = niveisDesenhaveis(NIVEIS_TESTE_ACUIDADE, 600, PX_POR_MM_NOMINAL, 1);
    expect(n[n.length - 1]).toBe(0.4);
    // a 1 m e com DPR 3 já cabem todos
    expect(niveisDesenhaveis(NIVEIS_TESTE_ACUIDADE, 1000, PX_POR_MM_NOMINAL, 3)).toHaveLength(12);
  });

  it("conversões de resultado: decimal e fracção 6/x arredondada a 0,5", () => {
    expect(logmarParaDecimal(0)).toBe(1);
    expect(logmarParaDecimal(0.3)).toBe(0.5);
    expect(logmarParaDenominador6(0.2)).toBe(9.5);
    expect(logmarParaDenominador6(0.1)).toBe(7.5);
    expect(fraccao6(0)).toBe("6/6");
    expect(fraccao6(0.1)).toBe("6/7,5");
    expect(fraccao6(0.1, ".")).toBe("6/7.5");
  });

  it("calibração pelo cartão: largura em px / 85,6 mm", () => {
    expect(pxPorMmDaLarguraDoCartao(342.4)).toBeCloseTo(4, 6);
  });
});
