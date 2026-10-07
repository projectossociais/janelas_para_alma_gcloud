import type { Circulo, Ponto } from "./tipos";

/**
 * Ajuste de círculos a pontos do contorno da íris.
 *
 * Primeiro um ajuste algébrico (Kåsa: linear, rápido, sem ponto de partida),
 * depois um refinamento geométrico (Gauss–Newton sobre a distância real ao
 * círculo, que o ajuste algébrico enviesa quando só há arcos). Contra pontos
 * errados (pestanas, pálpebras, ruído), um RANSAC determinista: a mesma
 * fotografia dá sempre o mesmo resultado.
 */

/** Gerador pseudo-aleatório com semente (mulberry32): resultados reprodutíveis. */
export function geradorAleatorio(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Resolve um sistema 3×3 por eliminação de Gauss com pivô parcial. */
function resolver3(m: number[][], b: number[]): [number, number, number] | null {
  const a = m.map((linha, i) => [...linha, b[i] ?? 0]);
  for (let c = 0; c < 3; c++) {
    let pivo = c;
    for (let l = c + 1; l < 3; l++) if (Math.abs(a[l]![c]!) > Math.abs(a[pivo]![c]!)) pivo = l;
    if (Math.abs(a[pivo]![c]!) < 1e-12) return null;
    [a[c], a[pivo]] = [a[pivo]!, a[c]!];
    for (let l = c + 1; l < 3; l++) {
      const f = a[l]![c]! / a[c]![c]!;
      for (let k = c; k < 4; k++) a[l]![k]! -= f * a[c]![k]!;
    }
  }
  const x = [0, 0, 0];
  for (let l = 2; l >= 0; l--) {
    let s = a[l]![3]!;
    for (let k = l + 1; k < 3; k++) s -= a[l]![k]! * x[k]!;
    x[l] = s / a[l]![l]!;
  }
  return [x[0]!, x[1]!, x[2]!];
}

/** Ajuste algébrico (Kåsa): minimiza Σ(x² + y² + Dx + Ey + F)². */
export function ajustarCirculoAlgebrico(pontos: readonly Ponto[]): Circulo | null {
  if (pontos.length < 3) return null;
  // Centra os pontos para o sistema ficar bem condicionado.
  const mx = pontos.reduce((s, p) => s + p.x, 0) / pontos.length;
  const my = pontos.reduce((s, p) => s + p.y, 0) / pontos.length;
  let sxx = 0, sxy = 0, syy = 0, sx = 0, sy = 0, sxz = 0, syz = 0, sz = 0;
  for (const p of pontos) {
    const x = p.x - mx;
    const y = p.y - my;
    const z = x * x + y * y;
    sxx += x * x; sxy += x * y; syy += y * y; sx += x; sy += y;
    sxz += x * z; syz += y * z; sz += z;
  }
  const n = pontos.length;
  const sol = resolver3(
    [[sxx, sxy, sx], [sxy, syy, sy], [sx, sy, n]],
    [-sxz, -syz, -sz],
  );
  if (!sol) return null;
  const [d, e, f] = sol;
  const cx = -d / 2;
  const cy = -e / 2;
  const r2 = cx * cx + cy * cy - f;
  if (!(r2 > 0)) return null;
  return { centro: { x: cx + mx, y: cy + my }, raio: Math.sqrt(r2) };
}

/** Refinamento geométrico: minimiza Σ(‖p − c‖ − r)² por Gauss–Newton. */
export function refinarCirculo(pontos: readonly Ponto[], inicial: Circulo, iteracoes = 20): Circulo {
  let { x: cx, y: cy } = inicial.centro;
  let r = inicial.raio;
  for (let it = 0; it < iteracoes; it++) {
    // Normais JᵀJ e Jᵀres, com J = ∂(dist − r)/∂(cx, cy, r).
    const jtj = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    const jtr = [0, 0, 0];
    for (const p of pontos) {
      const dx = p.x - cx;
      const dy = p.y - cy;
      const dist = Math.hypot(dx, dy) || 1e-9;
      const res = dist - r;
      const j = [-dx / dist, -dy / dist, -1];
      for (let a = 0; a < 3; a++) {
        jtr[a]! += j[a]! * res;
        for (let b = 0; b < 3; b++) jtj[a]![b]! += j[a]! * j[b]!;
      }
    }
    const passo = resolver3(jtj, jtr.map((v) => -v));
    if (!passo) break;
    cx += passo[0];
    cy += passo[1];
    r += passo[2];
    if (Math.hypot(passo[0], passo[1], passo[2]) < 1e-6) break;
  }
  return { centro: { x: cx, y: cy }, raio: r };
}

/** Raiz do erro quadrático médio da distância dos pontos ao círculo. */
export function erroQuadraticoMedio(pontos: readonly Ponto[], c: Circulo): number {
  if (pontos.length === 0) return Number.NaN;
  const s = pontos.reduce((acc, p) => acc + (Math.hypot(p.x - c.centro.x, p.y - c.centro.y) - c.raio) ** 2, 0);
  return Math.sqrt(s / pontos.length);
}

export interface AjusteRobusto {
  circulo: Circulo;
  /** Pontos que concordam com o círculo final. */
  inliers: Ponto[];
  erroQuadraticoMedio: number;
}

/**
 * RANSAC: escolhe ao acaso (com semente) trios de pontos, fica com o círculo
 * que mais pontos aceita (distância ≤ `limiarPx`) e reajusta-o só com esses.
 */
export function ajustarCirculoRobusto(
  pontos: readonly Ponto[],
  opcoes: { limiarPx?: number; iteracoes?: number; semente?: number } = {},
): AjusteRobusto | null {
  const { limiarPx = 1, iteracoes = 300, semente = 1 } = opcoes;
  if (pontos.length < 3) return null;
  const aleatorio = geradorAleatorio(semente);
  const aceites = (c: Circulo) =>
    pontos.filter((p) => Math.abs(Math.hypot(p.x - c.centro.x, p.y - c.centro.y) - c.raio) <= limiarPx);

  let melhor: Ponto[] = [];
  for (let it = 0; it < iteracoes; it++) {
    const i = Math.floor(aleatorio() * pontos.length);
    const j = Math.floor(aleatorio() * pontos.length);
    const k = Math.floor(aleatorio() * pontos.length);
    if (i === j || j === k || i === k) continue;
    const c = ajustarCirculoAlgebrico([pontos[i]!, pontos[j]!, pontos[k]!]);
    if (!c) continue;
    const dentro = aceites(c);
    if (dentro.length > melhor.length) melhor = dentro;
  }
  if (melhor.length < 3) return null;

  // Reajuste com os aceites, e uma segunda passagem para estabilizar o conjunto.
  let circulo = ajustarCirculoAlgebrico(melhor);
  if (!circulo) return null;
  circulo = refinarCirculo(melhor, circulo);
  const finais = aceites(circulo);
  if (finais.length >= 3) circulo = refinarCirculo(finais, circulo);
  return { circulo, inliers: finais, erroQuadraticoMedio: erroQuadraticoMedio(finais, circulo) };
}

/** Elipse com os eixos alinhados com a imagem (íris de um olho rodado na horizontal). */
export interface Elipse {
  centro: Ponto;
  /** Semi-eixo horizontal (px). */
  a: number;
  /** Semi-eixo vertical (px). */
  b: number;
}

/** Distância aproximada (px) de um ponto ao contorno de uma elipse quase circular. */
export const distanciaElipse = (p: Ponto, e: Elipse) =>
  (Math.hypot((p.x - e.centro.x) / e.a, (p.y - e.centro.y) / e.b) - 1) * Math.sqrt(e.a * e.b);

/** Resolve A·x = b (n×n) por eliminação de Gauss com pivô parcial. */
function resolver(m: number[][], b: number[]): number[] | null {
  const n = b.length;
  const a = m.map((linha, i) => [...linha, b[i] ?? 0]);
  for (let c = 0; c < n; c++) {
    let pivo = c;
    for (let l = c + 1; l < n; l++) if (Math.abs(a[l]![c]!) > Math.abs(a[pivo]![c]!)) pivo = l;
    if (Math.abs(a[pivo]![c]!) < 1e-12) return null;
    [a[c], a[pivo]] = [a[pivo]!, a[c]!];
    for (let l = c + 1; l < n; l++) {
      const f = a[l]![c]! / a[c]![c]!;
      for (let k = c; k <= n; k++) a[l]![k]! -= f * a[c]![k]!;
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let l = n - 1; l >= 0; l--) {
    let s = a[l]![n]!;
    for (let k = l + 1; k < n; k++) s -= a[l]![k]! * x[k]!;
    x[l] = s / a[l]![l]!;
  }
  return x;
}

/**
 * Ajuste geométrico de uma elipse alinhada (centro, a, b) por Levenberg–Marquardt,
 * a partir de um círculo. Amortecido porque, só com os arcos laterais, o semi-eixo
 * vertical fica mal determinado; o centro (o que interessa) fica bem.
 */
export function refinarElipseAlinhada(pontos: readonly Ponto[], inicial: Circulo, iteracoes = 40): Elipse {
  let e: Elipse = { centro: { ...inicial.centro }, a: inicial.raio, b: inicial.raio };
  const custo = (x: Elipse) => pontos.reduce((s, p) => s + distanciaElipse(p, x) ** 2, 0);
  let atual = custo(e);
  let lambda = 1e-3;
  for (let it = 0; it < iteracoes; it++) {
    const jtj = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
    const jtr = [0, 0, 0, 0];
    const escala = Math.sqrt(e.a * e.b);
    for (const p of pontos) {
      const dx = p.x - e.centro.x;
      const dy = p.y - e.centro.y;
      const rho = Math.hypot(dx / e.a, dy / e.b) || 1e-9;
      const res = (rho - 1) * escala;
      const j = [
        (-dx / (e.a * e.a * rho)) * escala,
        (-dy / (e.b * e.b * rho)) * escala,
        (-(dx * dx) / (e.a ** 3 * rho)) * escala,
        (-(dy * dy) / (e.b ** 3 * rho)) * escala,
      ];
      for (let i = 0; i < 4; i++) {
        jtr[i]! += j[i]! * res;
        for (let k = 0; k < 4; k++) jtj[i]![k]! += j[i]! * j[k]!;
      }
    }
    const amortecida = jtj.map((linha, i) => linha.map((v, k) => (i === k ? v * (1 + lambda) + 1e-9 : v)));
    const passo = resolver(amortecida, jtr.map((v) => -v));
    if (!passo) break;
    const candidata: Elipse = {
      centro: { x: e.centro.x + passo[0]!, y: e.centro.y + passo[1]! },
      a: e.a + passo[2]!,
      b: e.b + passo[3]!,
    };
    const novo = candidata.a > 0 && candidata.b > 0 ? custo(candidata) : Infinity;
    if (novo < atual) {
      e = candidata;
      lambda = Math.max(1e-6, lambda / 3);
      if (atual - novo < 1e-10) break;
      atual = novo;
    } else {
      lambda *= 5;
      if (lambda > 1e6) break;
    }
  }
  return e;
}
