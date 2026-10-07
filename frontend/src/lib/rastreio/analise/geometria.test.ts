import { describe, expect, it } from "vitest";
import { ajustarCirculoAlgebrico, ajustarCirculoRobusto, geradorAleatorio, refinarCirculo } from "./geometria";
import type { Ponto } from "./tipos";

const arco = (cx: number, cy: number, r: number, de: number, ate: number, n: number): Ponto[] =>
  Array.from({ length: n }, (_, i) => {
    const a = ((de + ((ate - de) * i) / (n - 1)) * Math.PI) / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });

describe("ajuste de círculos", () => {
  it("pontos exactos dão o círculo exacto", () => {
    const c = ajustarCirculoAlgebrico(arco(120.3, 80.7, 47.25, 0, 360, 40))!;
    expect(c.centro.x).toBeCloseTo(120.3, 6);
    expect(c.centro.y).toBeCloseTo(80.7, 6);
    expect(c.raio).toBeCloseTo(47.25, 6);
  });

  it("só com os dois arcos laterais (como no limbo), o refinamento geométrico recupera o centro", () => {
    const aleatorio = geradorAleatorio(3);
    const pontos = [...arco(100, 100, 50, -40, 40, 30), ...arco(100, 100, 50, 140, 220, 30)].map((p) => ({
      x: p.x + (aleatorio() - 0.5) * 0.4,
      y: p.y + (aleatorio() - 0.5) * 0.4,
    }));
    const c = refinarCirculo(pontos, ajustarCirculoAlgebrico(pontos)!);
    expect(Math.abs(c.centro.x - 100)).toBeLessThan(0.1);
    expect(Math.abs(c.centro.y - 100)).toBeLessThan(0.3);
    expect(Math.abs(c.raio - 50)).toBeLessThan(0.2);
  });

  it("o RANSAC ignora 30% de pontos errados (pestanas, pálpebra)", () => {
    const bons = arco(60, 60, 40, -40, 40, 35).concat(arco(60, 60, 40, 140, 220, 35));
    const aleatorio = geradorAleatorio(9);
    const maus = Array.from({ length: 30 }, () => ({ x: 20 + aleatorio() * 80, y: 20 + aleatorio() * 80 }));
    const ajuste = ajustarCirculoRobusto([...bons, ...maus])!;
    expect(Math.abs(ajuste.circulo.centro.x - 60)).toBeLessThan(0.05);
    expect(Math.abs(ajuste.circulo.centro.y - 60)).toBeLessThan(0.05);
    expect(ajuste.inliers.length).toBeGreaterThanOrEqual(70);
  });

  it("é determinista: a mesma entrada dá sempre o mesmo resultado", () => {
    const aleatorio = geradorAleatorio(5);
    const pontos = arco(50, 50, 30, 0, 360, 50).map((p) => ({ x: p.x + aleatorio(), y: p.y + aleatorio() }));
    expect(ajustarCirculoRobusto(pontos)).toEqual(ajustarCirculoRobusto(pontos));
  });

  it("menos de três pontos não dá círculo", () => {
    expect(ajustarCirculoAlgebrico([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBeNull();
    expect(ajustarCirculoRobusto([{ x: 0, y: 0 }])).toBeNull();
  });
});
