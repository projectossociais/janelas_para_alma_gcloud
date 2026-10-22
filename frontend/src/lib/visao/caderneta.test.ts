import { describe, expect, it } from "vitest";
import {
  ALVO_OMISSAO_MIN,
  TOTAL_CROMOS,
  VERIFICAR_CADA_MIN,
  confirmar,
  cromoDoDia,
  diasCumpridos,
  guardarAlvo,
  guardarPeriodo,
  iniciarPeriodo,
  lerAlvo,
  lerPeriodo,
  minutosDeTapaPorDia,
  precisaVerificar,
  resumoSemana,
  segundosContados,
} from "./caderneta";

const MIN = 60_000;

describe("período de tapa-olho", () => {
  it("conta o tempo até à hora de perguntar; depois, só até à última confirmação", () => {
    const p = iniciarPeriodo(0, 120, "esquerdo");
    expect(segundosContados(p, 10 * MIN)).toBe(600);
    expect(precisaVerificar(p, VERIFICAR_CADA_MIN * MIN)).toBe(true);
    // Esqueceram-se de responder (ou fecharam a página): 40 min depois só contam os confirmados (0).
    expect(segundosContados(p, 40 * MIN)).toBe(0);
    const c = confirmar(p, 15 * MIN);
    expect(c.verificacoes).toBe(1);
    expect(segundosContados(c, 20 * MIN)).toBe(20 * 60);
  });
});

describe("dias e cromos", () => {
  const sessao = (dia: number, minutos: number, modo = "tapa_olho_horas") => ({
    created_at: new Date(2026, 9, dia, 18).toISOString(),
    segundos_activos: minutos * 60,
    sinais: { modo },
  });

  it("minutos de tapa-olho por dia, só das sessões de tapa-olho", () => {
    const m = minutosDeTapaPorDia([sessao(20, 60), sessao(20, 70), sessao(21, 30), sessao(21, 99, "outro")]);
    expect(m.get("2026-10-20")).toBe(130);
    expect(m.get("2026-10-21")).toBe(30);
  });

  it("dias cumpridos e cromos por ordem", () => {
    const m = minutosDeTapaPorDia([sessao(18, 130), sessao(19, 50), sessao(20, 120)]);
    expect(diasCumpridos(m, 120)).toEqual(["2026-10-18", "2026-10-20"]);
    expect(cromoDoDia(0)).toBe(0);
    expect(cromoDoDia(TOTAL_CROMOS + 2)).toBe(2);
  });

  it("resumo da semana para o médico", () => {
    const m = minutosDeTapaPorDia([sessao(15, 120), sessao(21, 60)]);
    const r = resumoSemana(m, 120, new Date(2026, 9, 21, 20));
    expect(r.minutos).toEqual([120, 0, 0, 0, 0, 0, 60]);
    expect(r).toMatchObject({ mediaMin: 26, pctDoReceitado: 22, cumpridos: 1 });
  });
});

describe("guardado no aparelho", () => {
  it("o período em curso e o tempo receitado", () => {
    window.localStorage.clear();
    expect(lerPeriodo()).toBeNull();
    const p = iniciarPeriodo(1000, 240, "direito");
    guardarPeriodo(p);
    expect(lerPeriodo()).toEqual(p);
    guardarPeriodo(null);
    expect(lerPeriodo()).toBeNull();
    expect(lerAlvo()).toBe(ALVO_OMISSAO_MIN);
    guardarAlvo(240);
    expect(lerAlvo()).toBe(240);
    window.localStorage.clear();
  });
});
