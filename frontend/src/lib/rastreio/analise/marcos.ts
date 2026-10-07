import type { Circulo, Ponto } from "./tipos";

/**
 * Dos marcos do FaceMesh (MediaPipe, com `refineLandmarks`) às posições
 * aproximadas das duas íris, em píxeis da fotografia.
 *
 * Cada íris tem um marco no centro e quatro no contorno. O detector trabalha
 * numa versão reduzida da cara e erra alguns píxeis na fotografia em resolução
 * total: isto é só o ponto de partida; o motor mede o centro e o raio a sério
 * (`olho.ts`, `limbo.ts`).
 */

/** Centro e contorno de cada íris nos marcos do FaceMesh. */
export const MARCOS_IRIS = [
  { centro: 468, contorno: [469, 470, 471, 472] },
  { centro: 473, contorno: [474, 475, 476, 477] },
] as const;

export interface MarcoNormalizado {
  /** 0–1, fracção da largura da imagem. */
  x: number;
  /** 0–1, fracção da altura da imagem. */
  y: number;
}

/** Raio mínimo plausível (px) para uma íris vinda do detector. */
const RAIO_MINIMO_PX = 3;

/**
 * As duas íris (a da esquerda da imagem primeiro), ou `null` se os marcos não
 * chegarem ou não fizerem sentido (raios muito diferentes, íris sobrepostas).
 */
export function irisDosMarcos(
  marcos: readonly MarcoNormalizado[],
  largura: number,
  altura: number,
): [Circulo, Circulo] | null {
  const px = (i: number): Ponto | null => {
    const m = marcos[i];
    return m && Number.isFinite(m.x) && Number.isFinite(m.y) ? { x: m.x * largura, y: m.y * altura } : null;
  };
  const circulos: Circulo[] = [];
  for (const { centro, contorno } of MARCOS_IRIS) {
    const c = px(centro);
    const pontos = contorno.map(px);
    if (!c || pontos.some((p) => !p)) return null;
    const raio = pontos.reduce((s, p) => s + Math.hypot(p!.x - c.x, p!.y - c.y), 0) / pontos.length;
    if (!(raio >= RAIO_MINIMO_PX)) return null;
    circulos.push({ centro: c, raio });
  }
  const [a, b] = circulos as [Circulo, Circulo];
  const distancia = Math.hypot(a.centro.x - b.centro.x, a.centro.y - b.centro.y);
  const proporcaoRaios = Math.max(a.raio, b.raio) / Math.min(a.raio, b.raio);
  // Íris sobrepostas ou de tamanhos absurdos: o detector enganou-se.
  if (distancia < 3 * Math.max(a.raio, b.raio) || proporcaoRaios > 1.5) return null;
  return a.centro.x <= b.centro.x ? [a, b] : [b, a];
}
