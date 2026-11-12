import { describe, expect, it } from "vitest";
import {
  DIRECCOES_E,
  FRACCAO_MAX_ECRA_BARRAS,
  LADO_COM_BARRAS_TRACOS,
  cabeComBarras,
  indiceDaPalanca,
  iniciarPalanca,
  ladoComBarrasPx,
  limiarDaPalanca,
  melhorLimiar,
  olhoAConfirmar,
  palancaTerminou,
  responderPalanca,
  respostasDaPalanca,
  treinoPassou,
  type EstadoPalanca,
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

// 2026-11-12: barras à volta da mãozinha, medição em duas fases, treino e confirmação.
describe("barras à volta da mãozinha", () => {
  it("o conjunto mede 12 traços: mãozinha (5) + meia mãozinha de folga e uma barra de cada lado", () => {
    expect(LADO_COM_BARRAS_TRACOS).toBe(12);
    expect(ladoComBarrasPx(0.0, 3000, 1)).toBeCloseTo((4.36 * 12) / 5, 1);
  });

  it("num telemóvel a 3 m cabem do 6/30 para baixo; os maiores ficam isolados", () => {
    const ladoMax = 360 * FRACCAO_MAX_ECRA_BARRAS;
    expect(cabeComBarras(0.7, 3000, 6, ladoMax)).toBe(true);
    expect(cabeComBarras(0.3, 3000, 6, ladoMax)).toBe(true);
    expect(cabeComBarras(1.0, 3000, 6, ladoMax)).toBe(false);
  });
});

describe("medição em duas fases", () => {
  const NIVEIS = [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.0, -0.1];
  const responder = (e: EstadoPalanca, respostas: boolean[]) => respostas.reduce((acc, r) => responderPalanca(acc, r), e);
  /** Observador que vê sempre até ao índice `limite` e erra a partir daí. */
  const simular = (limite: number, inicio = 3) => {
    let e = iniciarPalanca(NIVEIS.length, inicio);
    let guarda = 0;
    while (!palancaTerminou(e) && guarda++ < 200) e = responderPalanca(e, indiceDaPalanca(e) <= limite);
    return e;
  };

  it("descida rápida: uma mãozinha por tamanho enquanto acerta", () => {
    const e = responder(iniciarPalanca(NIVEIS.length, 3), [true, true, true]);
    expect(e.escada).toBeNull();
    expect(indiceDaPalanca(e)).toBe(6);
    expect(respostasDaPalanca(e)).toBe(3);
  });

  it("ao primeiro erro, o limiar começa dois tamanhos acima, com 4 por tamanho e 3 para passar", () => {
    const e = responder(iniciarPalanca(NIVEIS.length, 3), [true, true, false]); // erra no índice 5
    expect(indiceDaPalanca(e)).toBe(3);
    expect(e.escada?.regra).toEqual({ tentativas: 4, acertos: 3 });
    // 2 acertos não chegam para passar; o 3.º passa.
    expect(indiceDaPalanca(responder(e, [true, true]))).toBe(3);
    expect(indiceDaPalanca(responder(e, [true, true, true]))).toBe(4);
    // Um erro ainda deixa passar (3 em 4); dois erros falham o tamanho.
    expect(indiceDaPalanca(responder(e, [true, false, true, true]))).toBe(4);
  });

  it("errar logo a primeira não sai da lista: o limiar começa no maior tamanho possível", () => {
    const e = responder(iniciarPalanca(NIVEIS.length, 1), [false]);
    expect(indiceDaPalanca(e)).toBe(0);
  });

  it("encontra o limiar de quem vê até 6/12 (índice 7)", () => {
    const e = simular(7);
    expect(palancaTerminou(e)).toBe(true);
    expect(limiarDaPalanca(e, NIVEIS)).toBeCloseTo(0.3, 5);
    // Descida rápida (5) + limiar (3 + 3 + 2): menos de 20 respostas.
    expect(respostasDaPalanca(e)).toBeLessThan(20);
  });

  it("um erro no último tamanho passado piora um quarto de linha", () => {
    // Rápida: acerta 3, 4; erra 5 -> limiar a partir do 3.
    let e = responder(iniciarPalanca(NIVEIS.length, 3), [true, true, false]);
    e = responder(e, [true, true, true]); // 0,7
    e = responder(e, [true, false, true, true]); // 0,6 com um erro
    e = responder(e, [false, false]); // 0,5 falha
    expect(palancaTerminou(e)).toBe(true);
    expect(limiarDaPalanca(e, NIVEIS)).toBeCloseTo(0.625, 5);
  });

  it("quem acerta tudo confirma o tamanho mais pequeno e marca o limite do ecrã", () => {
    const e = simular(99);
    expect(e.escada?.atingiuLimite).toBe(true);
    expect(limiarDaPalanca(e, NIVEIS)).toBeCloseTo(-0.1, 5);
  });

  it("quem não vê nem a maior fica sem limiar (null), nunca com o tamanho de partida", () => {
    const e = simular(-1);
    expect(palancaTerminou(e)).toBe(true);
    expect(limiarDaPalanca(e, NIVEIS)).toBeNull();
  });

  it("a meio do teste ainda não há limiar", () => {
    expect(limiarDaPalanca(iniciarPalanca(NIVEIS.length, 3), NIVEIS)).toBeNull();
  });

  it("a adivinhar entre 4 lados, passar um tamanho é raro (cerca de 5%; com 2 em 3 eram 16%)", () => {
    const p = 0.25;
    const passa3de4 = 4 * p ** 3 * (1 - p) + p ** 4;
    const passa2de3 = 3 * p ** 2 * (1 - p) + p ** 3;
    expect(passa3de4).toBeLessThan(0.06);
    expect(passa2de3).toBeGreaterThan(0.15);
  });
});

describe("treino com os dois olhos", () => {
  it("passa com 3 de 4; com 2 a criança ainda não percebeu o jogo", () => {
    expect(treinoPassou(4)).toBe(true);
    expect(treinoPassou(3)).toBe(true);
    expect(treinoPassou(2)).toBe(false);
  });
});

describe("confirmar a diferença entre os olhos", () => {
  it("com 2 linhas ou mais, repete-se o olho pior", () => {
    expect(olhoAConfirmar(0.1, 0.3)).toBe("esquerdo");
    expect(olhoAConfirmar(0.5, 0.1)).toBe("direito");
  });

  it("com menos de 2 linhas não se repete nada", () => {
    expect(olhoAConfirmar(0.1, 0.2)).toBeNull();
    expect(olhoAConfirmar(0.3, 0.3)).toBeNull();
  });

  it("um olho que não leu a maior repete-se; os dois sem ler, não", () => {
    expect(olhoAConfirmar(null, 0.2)).toBe("direito");
    expect(olhoAConfirmar(0.2, null)).toBe("esquerdo");
    expect(olhoAConfirmar(null, null)).toBeNull();
  });

  it("fica o melhor dos dois resultados", () => {
    expect(melhorLimiar(0.5, 0.3)).toBe(0.3);
    expect(melhorLimiar(null, 0.3)).toBe(0.3);
    expect(melhorLimiar(0.4, null)).toBe(0.4);
    expect(melhorLimiar(null, null)).toBeNull();
  });
});
