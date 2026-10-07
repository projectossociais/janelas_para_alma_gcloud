import { describe, expect, it } from "vitest";
import { irisDosMarcos, type MarcoNormalizado } from "./marcos";

const L = 4000;
const A = 3000;

/** 478 marcos vazios, com as duas íris desenhadas em píxeis. */
function marcosCom(iris: { cx: number; cy: number; r: number }[]): MarcoNormalizado[] {
  const marcos: MarcoNormalizado[] = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
  iris.forEach(({ cx, cy, r }, k) => {
    const base = k === 0 ? 468 : 473;
    marcos[base] = { x: cx / L, y: cy / A };
    [[r, 0], [0, -r], [-r, 0], [0, r]].forEach(([dx, dy], i) => {
      marcos[base + 1 + i] = { x: (cx + dx!) / L, y: (cy + dy!) / A };
    });
  });
  return marcos;
}

describe("íris a partir dos marcos do FaceMesh", () => {
  it("converte para píxeis da fotografia, com o raio pelo contorno", () => {
    const r = irisDosMarcos(marcosCom([{ cx: 1500, cy: 1200, r: 50 }, { cx: 2100, cy: 1210, r: 48 }]), L, A)!;
    expect(r[0].centro.x).toBeCloseTo(1500, 6);
    expect(r[0].centro.y).toBeCloseTo(1200, 6);
    expect(r[0].raio).toBeCloseTo(50, 6);
    expect(r[1].raio).toBeCloseTo(48, 6);
  });

  it("devolve sempre primeiro a íris da esquerda da imagem", () => {
    const r = irisDosMarcos(marcosCom([{ cx: 2100, cy: 1200, r: 50 }, { cx: 1500, cy: 1200, r: 50 }]), L, A)!;
    expect(r[0].centro.x).toBeLessThan(r[1].centro.x);
  });

  it("sem os marcos das íris (modelo sem refineLandmarks) não há resultado", () => {
    expect(irisDosMarcos(Array.from({ length: 468 }, () => ({ x: 0.5, y: 0.5 })), L, A)).toBeNull();
  });

  it("íris sobrepostas ou de tamanhos absurdos são um engano do detector", () => {
    expect(irisDosMarcos(marcosCom([{ cx: 1500, cy: 1200, r: 50 }, { cx: 1560, cy: 1200, r: 50 }]), L, A)).toBeNull();
    expect(irisDosMarcos(marcosCom([{ cx: 1500, cy: 1200, r: 50 }, { cx: 2100, cy: 1200, r: 20 }]), L, A)).toBeNull();
  });
});
