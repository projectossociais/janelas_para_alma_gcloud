import { describe, expect, it } from "vitest";
import { DIAMETRO_IRIS_MM } from "./binocular";
import { geradorAleatorio } from "./geometria";
import { ajustarLimbo } from "./limbo";
import { medirOlho } from "./olho";
import { localizarReflexo } from "./reflexo";
import { gerarCena, type OlhoSintetico } from "./testes/cenaSintetica";
import type { Circulo } from "./tipos";

/**
 * Fase V0 (docs/MOTOR_ANALISE_RASTREIO.md §8): o motor recupera, em imagens
 * sintéticas com verdade conhecida, a posição do reflexo em relação ao centro
 * da íris. Critério escrito antes de programar: erro < 0,05 mm em 95% dos casos.
 */

const LADO = 200;
const centro = { x: 100.37, y: 99.81 };

function cenaUmOlho(olho: Partial<OlhoSintetico> & { raioIris?: number }, extra: { ruido?: number; desfoque?: number; semente?: number } = {}) {
  const o: OlhoSintetico = {
    centroIris: centro,
    raioIris: 48,
    reflexo: { x: centro.x + 4.2, y: centro.y - 1.3 },
    ...olho,
  };
  return { img: gerarCena({ largura: LADO, altura: LADO, olhos: [o], ...extra }), olho: o };
}

const aproximacao = (o: OlhoSintetico, erroCentro = { x: 0, y: 0 }, fatorRaio = 1): Circulo => ({
  centro: { x: o.centroIris.x + erroCentro.x, y: o.centroIris.y + erroCentro.y },
  raio: o.raioIris * fatorRaio,
});

describe("reflexo da córnea", () => {
  it("encontra o centro do reflexo com precisão abaixo do píxel", () => {
    const { img, olho } = cenaUmOlho({});
    const r = localizarReflexo(img, aproximacao(olho));
    expect(r.ok).toBe(true);
    if (r.ok === false) return;
    expect(Math.hypot(r.valor.centro.x - olho.reflexo!.x, r.valor.centro.y - olho.reflexo!.y)).toBeLessThan(0.15);
  });

  it("sem luz não há reflexo", () => {
    const { img, olho } = cenaUmOlho({ reflexo: null });
    expect(localizarReflexo(img, aproximacao(olho))).toEqual({ ok: false, motivo: "sem-reflexo" });
  });

  it("dois reflexos comparáveis (óculos, janela) recusam a fotografia", () => {
    const { img, olho } = cenaUmOlho({ reflexosExtra: [{ x: centro.x - 15, y: centro.y + 8 }] });
    expect(localizarReflexo(img, aproximacao(olho))).toEqual({ ok: false, motivo: "reflexos-multiplos" });
  });

  it("luz grande e difusa (ex.: ecrã) não conta como reflexo pontual", () => {
    const { img, olho } = cenaUmOlho({ reflexoDifuso: true });
    expect(localizarReflexo(img, aproximacao(olho))).toEqual({ ok: false, motivo: "reflexo-difuso" });
  });
});

describe("contorno da íris (limbo)", () => {
  it("recupera centro e raio, mesmo com a pálpebra a tapar um terço da íris", () => {
    const { img, olho } = cenaUmOlho({ reflexo: null, palpebraSuperior: 0.33 });
    const l = ajustarLimbo(img, aproximacao(olho, { x: 4, y: -3 }, 1.1));
    expect(l.ok).toBe(true);
    if (l.ok === false) return;
    expect(Math.abs(l.valor.circulo.centro.x - olho.centroIris.x)).toBeLessThan(0.15);
    expect(Math.abs(l.valor.circulo.centro.y - olho.centroIris.y)).toBeLessThan(0.4);
    expect(Math.abs(l.valor.circulo.raio - olho.raioIris)).toBeLessThan(0.3);
  });

  it("olho fechado não tem limbo", () => {
    const { img, olho } = cenaUmOlho({ fechado: true, reflexo: null });
    expect(ajustarLimbo(img, aproximacao(olho)).ok).toBe(false);
  });
});

describe("medição de um olho — critério V0", () => {
  it("em 120 olhos variados, a descentração tem erro < 0,05 mm em 95% dos casos", () => {
    const aleatorio = geradorAleatorio(2026);
    const entre = (a: number, b: number) => a + (b - a) * aleatorio();
    const errosMm: number[] = [];
    let falhas = 0;
    for (let i = 0; i < 120; i++) {
      const raio = entre(40, 58); // íris de 80 a 116 px: 30–45 cm com a câmara traseira
      const c = { x: 100 + entre(-0.5, 0.5), y: 100 + entre(-0.5, 0.5) };
      const off = { x: entre(-0.55, 0.55) * raio, y: entre(-0.3, 0.3) * raio };
      const olho: OlhoSintetico = {
        centroIris: c,
        raioIris: raio,
        reflexo: { x: c.x + off.x, y: c.y + off.y },
        tomIris: entre(25, 90), // de castanho muito escuro a mais claro
        palpebraSuperior: entre(0, 0.35),
      };
      const img = gerarCena({
        largura: LADO,
        altura: LADO,
        olhos: [olho],
        tomPele: entre(60, 160),
        desfoque: entre(0.7, 1.6),
        ruido: entre(1, 5),
        semente: i + 1,
      });
      // O detector de rosto erra: centro até 15% do raio, raio até ±15%.
      const aprox = aproximacao(olho, { x: entre(-0.15, 0.15) * raio, y: entre(-0.15, 0.15) * raio }, entre(0.85, 1.15));
      const m = medirOlho(img, aprox);
      if (m.ok === false) {
        falhas++;
        continue;
      }
      const mmPorPx = DIAMETRO_IRIS_MM / (2 * raio);
      const medido = { x: m.valor.reflexo.x - m.valor.iris.centro.x, y: m.valor.reflexo.y - m.valor.iris.centro.y };
      errosMm.push(Math.hypot(medido.x - off.x, medido.y - off.y) * mmPorPx);
    }
    errosMm.sort((a, b) => a - b);
    const p95 = errosMm[Math.floor(0.95 * (errosMm.length - 1))]!;
    expect(falhas).toBeLessThanOrEqual(6); // ≤ 5% de imagens boas recusadas
    expect(p95).toBeLessThan(0.05);
  }, 60_000);
});

describe("desvios grandes", () => {
  it("reflexo longe do centro (~55 Δ) com o detector de rosto a errar para o outro lado ainda se mede", () => {
    // Era recusado como "sem reflexo": ficava fora da zona de procura inicial.
    const reflexo = { x: centro.x + 0.55 * 48, y: centro.y };
    const { img, olho } = cenaUmOlho({ reflexo });
    const m = medirOlho(img, aproximacao(olho, { x: -0.15 * 48, y: 0.1 * 48 }, 0.85));
    expect(m.ok).toBe(true);
    if (m.ok === false) return;
    expect(Math.abs(m.valor.reflexo.x - m.valor.iris.centro.x - 0.55 * 48)).toBeLessThan(0.4);
  });
});

describe("estimativa grosseira do tamanho da íris", () => {
  // Bug real (bancada, 2026-10-01): a estimativa do raio pela distância entre os
  // olhos assume a anatomia média de um adulto; em crianças (olhos mais juntos,
  // íris já quase do tamanho adulto) pode errar 20% ou mais.
  it.each([0.6, 0.75, 1.3, 1.6])("mede bem com o raio aproximado %s× o real", (fator) => {
    const { img, olho } = cenaUmOlho({ reflexo: { x: centro.x + 6, y: centro.y - 2 } });
    const m = medirOlho(img, aproximacao(olho, { x: 3, y: -2 }, fator));
    expect(m.ok).toBe(true);
    if (m.ok === false) return;
    expect(Math.abs(m.valor.iris.raio - 48)).toBeLessThan(0.4);
    expect(Math.abs(m.valor.reflexo.x - m.valor.iris.centro.x - 6)).toBeLessThan(0.3);
  });
});

describe("portões de qualidade de um olho", () => {
  it("íris pequena demais (longe demais) é recusada", () => {
    const { img, olho } = cenaUmOlho({ raioIris: 28, reflexo: { x: centro.x + 2, y: centro.y } });
    expect(medirOlho(img, aproximacao(olho))).toEqual({ ok: false, motivo: "iris-pequena" });
  });

  it("olho fechado é recusado", () => {
    const { img, olho } = cenaUmOlho({ fechado: true, reflexo: null });
    expect(medirOlho(img, aproximacao(olho)).ok).toBe(false);
  });

  it("reflexo no bordo da íris (olhar muito desviado ou outra luz) é recusado", () => {
    const { img, olho } = cenaUmOlho({ reflexo: { x: centro.x + 38, y: centro.y + 2 } });
    const m = medirOlho(img, aproximacao(olho, { x: 0, y: 0 }, 1.3));
    expect(m.ok).toBe(false);
  });
});
