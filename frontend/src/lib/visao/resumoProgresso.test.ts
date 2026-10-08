import { describe, expect, it } from "vitest";
import { actividade, eixoDosLimiares, olhosComResultados, serieDeLimiares } from "./resumoProgresso";
import type { SessaoResumo } from "./progresso";

const HOJE = new Date(2026, 9, 8, 15, 0); // 8 de Outubro, hora local

/** Uma sessão às 10h locais do dia `d` de Outubro. */
const s = (over: Partial<SessaoResumo> & { d: number; h?: number }): SessaoResumo => {
  const { d, h = 10, ...resto } = over;
  return {
    exercicio_id: "ambliopia",
    created_at: new Date(2026, 9, d, h, 0).toISOString(),
    segundos_activos: 300,
    olho: "esquerdo",
    limiar: null,
    unidade: null,
    sinais: null,
    ...resto,
  };
};

describe("actividade (últimos 14 dias)", () => {
  it("14 dias, do mais antigo a hoje, com hoje marcado", () => {
    const a = actividade([], HOJE);
    expect(a.dias).toHaveLength(14);
    expect(a.dias[13]).toMatchObject({ dia: "2026-10-08", hoje: true });
    expect(a.dias[0]).toMatchObject({ dia: "2026-09-25", hoje: false });
    expect(a.totalMinutos).toBe(0);
    expect(a.maximo).toBe(1); // nunca divide por 0
  });

  it("soma só o que conta para a dose: treinos sem baixa atenção", () => {
    const a = actividade(
      [
        s({ d: 8 }), // 5 min
        s({ d: 8, h: 12 }), // + 5 min no mesmo dia
        s({ d: 7, sinais: { baixa_atencao: true } }), // não conta
        s({ d: 6, exercicio_id: "figure8" }), // teste: não conta para a dose
      ],
      HOJE,
    );
    expect(a.dias[13].minutos).toBe(10);
    expect(a.dias[12].minutos).toBe(0);
    expect(a.totalMinutos).toBe(10);
    expect(a.diasComTreino).toBe(1);
    expect(a.maximo).toBe(10);
  });

  it("conta a sequência de dias seguidos", () => {
    const a = actividade([s({ d: 8 }), s({ d: 7 }), s({ d: 6 }), s({ d: 4 })], HOJE);
    expect(a.sequencia).toBe(3);
    expect(a.diasComTreino).toBe(4);
  });

  it("ignora sessões fora da janela", () => {
    const a = actividade([s({ d: 1 }), s({ d: 8 })], new Date(2026, 9, 8, 15), 3);
    expect(a.dias).toHaveLength(3);
    expect(a.totalMinutos).toBe(5);
  });
});

describe("serieDeLimiares", () => {
  it("ignora as sessões de baixa atenção (como a tendência): não são uma medição fiável", () => {
    const serie = serieDeLimiares(
      [
        s({ d: 6, exercicio_id: "ambliopia", olho: "esquerdo", limiar: 0.4 }),
        s({ d: 6, h: 18, exercicio_id: "ambliopia", olho: "esquerdo", limiar: 1.0, sinais: { baixa_atencao: true } }),
        s({ d: 7, exercicio_id: "ambliopia", olho: "esquerdo", limiar: 1.0, sinais: { baixa_atencao: true } }),
      ],
      "ambliopia",
    );
    expect(serie).toEqual([{ dia: "2026-10-06", esquerdo: 0.4 }]);
  });

  it("um ponto por dia, nunca duas datas iguais; conta a última sessão do dia", () => {
    const serie = serieDeLimiares(
      [
        s({ d: 6, exercicio_id: "figure8", olho: "direito", limiar: 0.4 }),
        s({ d: 6, h: 18, exercicio_id: "figure8", olho: "direito", limiar: 0.3 }),
        s({ d: 6, exercicio_id: "figure8", olho: "esquerdo", limiar: 0.5 }),
        s({ d: 8, exercicio_id: "figure8", olho: "esquerdo", limiar: 0.4 }),
      ],
      "figure8",
    );
    expect(serie).toEqual([
      { dia: "2026-10-06", direito: 0.3, esquerdo: 0.5 },
      { dia: "2026-10-08", esquerdo: 0.4 },
    ]);
  });

  it("só o exercício pedido, só os dois olhos, só com limiar", () => {
    const serie = serieDeLimiares(
      [
        s({ d: 6, exercicio_id: "cerebro", olho: "direito", limiar: 1.2 }),
        s({ d: 6, exercicio_id: "figure8", olho: "ambos", limiar: 0.1 }),
        s({ d: 7, exercicio_id: "figure8", olho: "direito", limiar: null }),
      ],
      "figure8",
    );
    expect(serie).toEqual([]);
  });

  it("ordena do mais antigo para o mais recente, mesmo que o histórico venha ao contrário", () => {
    const serie = serieDeLimiares(
      [
        s({ d: 8, exercicio_id: "figure8", olho: "direito", limiar: 0.2 }),
        s({ d: 2, exercicio_id: "figure8", olho: "direito", limiar: 0.5 }),
      ],
      "figure8",
    );
    expect(serie.map((p) => p.dia)).toEqual(["2026-10-02", "2026-10-08"]);
  });
});

describe("eixoDosLimiares", () => {
  it("marcas em décimas exactas, de 0,1 abaixo a 0,1 acima (caso real: 0,3 a 0,7)", () => {
    const e = eixoDosLimiares([{ dia: "a", direito: 0.3, esquerdo: 0.7 }, { dia: "b", direito: 0.5 }]);
    expect(e.marcas).toEqual([0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]);
    expect(e.dominio).toEqual([0.2, 0.8]);
  });

  it("nunca marcas como 0,35 (que o arredondamento escreveria '0,3')", () => {
    const e = eixoDosLimiares([{ dia: "a", direito: 0.35 }, { dia: "b", direito: 1.05 }]);
    for (const m of e.marcas) expect(Math.round(m * 10)).toBeCloseTo(m * 10, 9);
  });

  it("com muito intervalo, de 0,2 em 0,2, sem cortar o maior valor", () => {
    const e = eixoDosLimiares([{ dia: "a", direito: 0.1 }, { dia: "b", esquerdo: 1.3 }]);
    expect(e.marcas[1] - e.marcas[0]).toBeCloseTo(0.2, 9);
    expect(e.dominio[0]).toBeLessThanOrEqual(0);
    expect(e.dominio[1]).toBeGreaterThanOrEqual(1.4);
  });

  it("um só ponto: o eixo não fica colado a ele", () => {
    const e = eixoDosLimiares([{ dia: "a", direito: 0.4 }]);
    expect(e.dominio).toEqual([0.3, 0.5]);
  });

  it("valores negativos (logMAR melhor que 6/6) também", () => {
    const e = eixoDosLimiares([{ dia: "a", direito: -0.1 }, { dia: "b", direito: 0.1 }]);
    expect(e.marcas).toEqual([-0.2, -0.1, 0, 0.1, 0.2]);
  });
});

describe("olhosComResultados", () => {
  it("treino só com o olho esquerdo: só o esquerdo (nunca o direito a pedir mais sessões)", () => {
    expect(olhosComResultados([s({ d: 6, limiar: 0.5 }), s({ d: 7, limiar: 0.4 })], "ambliopia")).toEqual(["esquerdo"]);
  });

  it("os dois olhos, pela ordem direito-esquerdo; só conta o exercício pedido e com limiar", () => {
    const sessoes = [
      s({ d: 6, exercicio_id: "figure8", olho: "esquerdo", limiar: 0.5 }),
      s({ d: 6, exercicio_id: "figure8", olho: "direito", limiar: 0.4 }),
      s({ d: 6, exercicio_id: "cerebro", olho: "direito", limiar: 1.2 }),
      s({ d: 6, exercicio_id: "ambliopia", olho: "direito", limiar: null }),
    ];
    expect(olhosComResultados(sessoes, "figure8")).toEqual(["direito", "esquerdo"]);
    expect(olhosComResultados(sessoes, "ambliopia")).toEqual([]);
  });
});
