import { describe, expect, it } from "vitest";
import { evolucaoDestacada, tendencia } from "./tendencia";

type S = Parameters<typeof tendencia>[0][number];

const sessao = (dia: number, limiar: number, extra: Partial<S> = {}): S => ({
  exercicio_id: "figure8",
  created_at: new Date(2026, 8, dia, 10).toISOString(),
  segundos_activos: 60,
  olho: "esquerdo",
  limiar,
  unidade: "logmar",
  sinais: null,
  calibrado: true,
  ...extra,
});

describe("tendencia (evolução em linguagem simples)", () => {
  it("sem pelo menos 2 sessões em dias diferentes, pede mais dados", () => {
    expect(tendencia([], "figure8", "esquerdo")).toEqual({ tipo: "poucos_dados" });
    expect(tendencia([sessao(1, 0.5)], "figure8", "esquerdo")).toEqual({ tipo: "poucos_dados" });
    // duas no mesmo dia não chegam: a melhoria de uma manhã não é evolução
    expect(tendencia([sessao(1, 0.5), sessao(1, 0.3)], "figure8", "esquerdo")).toEqual({ tipo: "poucos_dados" });
  });

  it("acuidade: 2 linhas mais pequenas (logMAR a descer) é melhoria, com os dias certos", () => {
    const r = tendencia([sessao(1, 0.5), sessao(8, 0.4), sessao(22, 0.3)], "figure8", "esquerdo");
    expect(r).toMatchObject({ tipo: "melhorou", unidade: "logmar", passos: 2, dias: 21, aproximado: false });
  });

  it("variação menor do que uma linha é 'estável' -- nunca promete melhoria que é ruído", () => {
    const r = tendencia([sessao(1, 0.5), sessao(5, 0.45)], "figure8", "esquerdo");
    expect(r).toMatchObject({ tipo: "estavel", passos: 0 });
  });

  it("acuidade a piorar é sinalizada", () => {
    const r = tendencia([sessao(1, 0.2), sessao(10, 0.4)], "figure8", "esquerdo");
    expect(r).toMatchObject({ tipo: "piorou", passos: 2 });
  });

  it("usa a mediana das primeiras e das últimas 3 -- um mau dia não vira a tendência", () => {
    const s = [0.6, 0.6, 0.6, 0.3, 0.3, 0.9].map((l, i) => sessao(i + 1, l));
    const r = tendencia(s, "figure8", "esquerdo");
    // início = mediana(0,6 0,6 0,6) = 0,6; fim = mediana(0,3 0,3 0,9) = 0,3 -> 3 linhas
    expect(r).toMatchObject({ tipo: "melhorou", passos: 3 });
  });

  it("contraste: log CS a subir é melhoria, em degraus de 0,15", () => {
    const s = [sessao(1, 1.2, { exercicio_id: "cerebro", unidade: "log_cs" }), sessao(9, 1.5, { exercicio_id: "cerebro", unidade: "log_cs" })];
    expect(tendencia(s, "cerebro", "esquerdo")).toMatchObject({ tipo: "melhorou", unidade: "log_cs", passos: 2 });
  });

  it("ignora o outro olho, outros exercícios e sessões de baixa atenção", () => {
    const s = [
      sessao(1, 0.5),
      sessao(3, 0.0, { olho: "direito" }),
      sessao(4, 0.0, { exercicio_id: "ambliopia" }),
      sessao(6, 0.0, { sinais: { baixa_atencao: true } }),
      sessao(8, 0.5),
    ];
    expect(tendencia(s, "figure8", "esquerdo")).toMatchObject({ tipo: "estavel" });
  });

  it("com sessões calibradas suficientes, as sem cartão ficam de fora", () => {
    const s = [sessao(1, 0.5), sessao(3, 0.0, { calibrado: false }), sessao(8, 0.5)];
    expect(tendencia(s, "figure8", "esquerdo")).toMatchObject({ tipo: "estavel", aproximado: false });
  });

  it("só com sessões sem cartão, o resultado sai marcado como aproximado", () => {
    const s = [sessao(1, 0.5, { calibrado: false }), sessao(8, 0.3, { calibrado: false })];
    expect(tendencia(s, "figure8", "esquerdo")).toMatchObject({ tipo: "melhorou", aproximado: true });
  });
});

describe("evolucaoDestacada (argumento do fim do trial)", () => {
  const aneis = (dia: number, limiar: number, extra: Partial<S> = {}) => sessao(dia, limiar, { exercicio_id: "ambliopia", ...extra });

  it("escolhe a maior melhoria entre exercícios e olhos", () => {
    const s = [
      aneis(1, 0.5), aneis(7, 0.4), // 1 linha, esquerdo
      sessao(1, 0.6, { olho: "direito" }), sessao(7, 0.3, { olho: "direito" }), // 3 linhas, direito, teste
    ];
    const r = evolucaoDestacada(s, ["ambliopia", "figure8"], null);
    expect(r).toMatchObject({ exercicioId: "figure8", olho: "direito", tendencia: { tipo: "melhorou", passos: 3 } });
  });

  it("com o olho mais fraco conhecido, só olha para esse olho", () => {
    const s = [sessao(1, 0.6, { olho: "direito" }), sessao(7, 0.3, { olho: "direito" }), aneis(1, 0.5), aneis(7, 0.4)];
    expect(evolucaoDestacada(s, ["ambliopia", "figure8"], "esquerdo")).toMatchObject({ olho: "esquerdo", exercicioId: "ambliopia" });
  });

  it("sem melhoria mas com piora, devolve a piora (para recomendar a consulta)", () => {
    const s = [aneis(1, 0.2), aneis(7, 0.4)];
    expect(evolucaoDestacada(s, ["ambliopia"], "esquerdo")).toMatchObject({ tendencia: { tipo: "piorou" } });
  });

  it("estável ou sem dados: nada a destacar", () => {
    expect(evolucaoDestacada([aneis(1, 0.4), aneis(7, 0.4)], ["ambliopia"], "esquerdo")).toBeNull();
    expect(evolucaoDestacada([], ["ambliopia", "figure8"], null)).toBeNull();
  });
});
