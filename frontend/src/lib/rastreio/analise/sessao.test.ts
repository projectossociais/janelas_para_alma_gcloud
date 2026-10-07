import { describe, expect, it } from "vitest";
import type { DesvioBinocular } from "./binocular";
import { DISPERSAO_MAXIMA_DELTA, agregarSessao, type ResultadoFotografia } from "./sessao";

const foto = (h: number, v = 0): ResultadoFotografia => ({
  ok: true,
  valor: {
    horizontalDelta: h,
    verticalDelta: v,
    mmPorPx: 0.12,
    direito: { nasal: 0.5, superior: 0 },
    esquerdo: { nasal: 0.5 - h / 21, superior: -v / 21 },
  } satisfies DesvioBinocular,
});
const falhou = (motivo: "sem-reflexo" | "limbo-irregular"): ResultadoFotografia => ({ ok: false, motivo });

describe("sessão de várias fotografias", () => {
  it("combina pela mediana: uma fotografia atípica não puxa o resultado", () => {
    const r = agregarSessao([foto(-9), foto(-10), foto(-11.5), foto(-10.4)]);
    expect(r.ok).toBe(true);
    if (r.ok === false) return;
    expect(r.valor.horizontalDelta).toBeCloseTo(-10.2, 6);
    expect(r.valor.fotografiasValidas).toBe(4);
  });

  it("fotografias que falham não contam, mas ficam registadas pelo motivo", () => {
    const r = agregarSessao([foto(-5), falhou("sem-reflexo"), foto(-6), falhou("sem-reflexo")]);
    expect(r.ok).toBe(true);
    if (r.ok === false) return;
    expect(r.valor.fotografiasValidas).toBe(2);
    expect(r.valor.fotografiasTotal).toBe(4);
  });

  it("com menos de duas fotografias válidas não há resultado (e diz-se porquê)", () => {
    const r = agregarSessao([foto(-5), falhou("sem-reflexo"), falhou("limbo-irregular")]);
    expect(r.ok).toBe(false);
    expect(r.detalhe?.falhas).toEqual({ "sem-reflexo": 1, "limbo-irregular": 1 });
  });

  it(`fotografias que discordam mais de ${DISPERSAO_MAXIMA_DELTA} Δ não dão número (a criança não fixou a luz)`, () => {
    const r = agregarSessao([foto(-2), foto(-9), foto(-3)]);
    expect(r).toMatchObject({ ok: false, motivo: "medicoes-inconsistentes" });
  });

  it("a dispersão vertical também conta", () => {
    expect(agregarSessao([foto(0, 0), foto(0, 5), foto(0, 0.5)])).toMatchObject({ ok: false });
  });
});
