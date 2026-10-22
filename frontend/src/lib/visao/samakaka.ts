/**
 * Pintar o Samakaka: treino com tapa-olho em que o olho mais fraco guia a mão
 * (desde 2026-10-21, no lugar do Treino de Contraste em blocos).
 *
 * Com o olho forte tapado, segue-se com o dedo um traço de pontinhos -- um
 * motivo do pano samakaka (zigue-zague, losango, ondas...). Seguido com
 * cuidado, o traço pinta-se; motivo a motivo, o pano fica pronto. Os
 * pontinhos vão ficando mais pequenos e mais claros, e a folga para sair do
 * traço mais apertada: é a coordenação olho-mão fina do olho fraco, que na
 * ambliopia fica para trás, num trabalho calmo e com um resultado para
 * guardar.
 *
 * Funções puras -- o desenho vive em `components/visao/PintarSamakaka.tsx`.
 */

type Ponto = readonly [number, number];

export interface Motivo {
  /** Chave do nome (i18n: `Visao.samakakaMotivo_<id>`). */
  id: string;
  cor: string;
  /** O traço, num quadrado de 0 a 1, do primeiro ao último ponto. */
  pontos: () => Ponto[];
}

const arco = (de: number, ate: number, n: number): Ponto[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = de + ((ate - de) * i) / n;
    return [0.5 + 0.4 * Math.cos(a), 0.5 + 0.28 * Math.sin(a)] as const;
  });

export const MOTIVOS: readonly Motivo[] = [
  { id: "zigue", cor: "#b3302a", pontos: () => Array.from({ length: 9 }, (_, i) => [0.1 + i * 0.1, i % 2 ? 0.3 : 0.7] as const) },
  { id: "losango", cor: "#e3a21a", pontos: () => [[0.5, 0.12], [0.86, 0.5], [0.5, 0.88], [0.14, 0.5], [0.5, 0.12]] },
  { id: "ondas", cor: "#111111", pontos: () => Array.from({ length: 41 }, (_, i) => [0.1 + i * 0.02, 0.5 + 0.22 * Math.sin((i / 40) * Math.PI * 4)] as const) },
  { id: "montes", cor: "#b3302a", pontos: () => [[0.08, 0.75], [0.22, 0.3], [0.36, 0.75], [0.5, 0.3], [0.64, 0.75], [0.78, 0.3], [0.92, 0.75]] },
  { id: "caracol", cor: "#e3a21a", pontos: () => [[0.12, 0.12], [0.88, 0.12], [0.88, 0.88], [0.2, 0.88], [0.2, 0.28], [0.72, 0.28], [0.72, 0.72], [0.36, 0.72], [0.36, 0.44], [0.56, 0.44]] },
  { id: "olho", cor: "#111111", pontos: () => [...arco(Math.PI, 2 * Math.PI, 20), ...arco(0, Math.PI, 20)] },
];

export interface NivelSamakaka {
  /** Diâmetro dos pontinhos do traço. */
  pontoMm: number;
  /** Contraste dos pontinhos (1 = preto). */
  contraste: number;
  /** Distância máxima do dedo ao traço para contar. */
  folgaMm: number;
}

/** O motivo n.º `i` (0, 1, 2...): os motivos repetem-se, cada vez mais difíceis, até um mínimo. */
export function nivelSamakaka(i: number): NivelSamakaka {
  const k = Math.min(i, 8);
  return {
    pontoMm: Math.round((2.2 - k * 0.2) * 100) / 100,
    contraste: Math.round((0.8 - k * 0.06) * 100) / 100,
    folgaMm: Math.round((4 - k * 0.3) * 100) / 100,
  };
}

/** O traço com um ponto a cada `passo` (mesmas unidades dos pontos). */
export function amostrarTraco(pts: readonly Ponto[], passo: number): [number, number][] {
  const out: [number, number][] = [];
  for (let k = 0; k < pts.length - 1; k++) {
    const [x0, y0] = pts[k];
    const [x1, y1] = pts[k + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / passo));
    for (let j = 0; j < n; j++) out.push([x0 + ((x1 - x0) * j) / n, y0 + ((y1 - y0) * j) / n]);
  }
  const [xu, yu] = pts[pts.length - 1];
  out.push([xu, yu]);
  return out;
}

/** Quantos pontos do traço se procuram à frente de onde o dedo vai (não deixa "saltar" atalhos). */
export const JANELA_TRACO = 30;

/**
 * O dedo em (x, y): qual o ponto do traço mais perto, entre um pouco atrás e
 * `JANELA_TRACO` à frente do progresso `k`, e a que distância está. Os
 * motivos fechados (losango, olho) acabam onde começam: sem a janela, tocar
 * no início dava o motivo por feito.
 */
export function pontoDoTraco(traco: readonly (readonly [number, number])[], k: number, x: number, y: number): { indice: number; distancia: number } {
  let indice = k;
  let distancia = Infinity;
  const ate = Math.min(traco.length - 1, k + JANELA_TRACO);
  for (let i = Math.max(0, k - 3); i <= ate; i++) {
    const d = Math.hypot(traco[i][0] - x, traco[i][1] - y);
    if (d < distancia) {
      distancia = d;
      indice = i;
    }
  }
  return { indice, distancia };
}

/** Feito: chegou (quase) ao último ponto. */
export const motivoFeito = (traco: readonly unknown[], k: number): boolean => k >= traco.length - 2;

export interface ResumoSamakaka {
  motivos: number;
  /** Afastamento médio do dedo ao traço, quando dentro da folga (mm). */
  mediaMm: number | null;
  /** Percentagem dos movimentos dentro da folga. */
  dentroPct: number | null;
  /** Os pontinhos mais pequenos de um motivo acabado (mm). */
  maisFinoMm: number | null;
}

export function resumirSamakaka(desviosMm: readonly number[], movimentos: number, fora: number, motivosFeitos: number): ResumoSamakaka {
  return {
    motivos: motivosFeitos,
    mediaMm: desviosMm.length ? Math.round((desviosMm.reduce((a, b) => a + b, 0) / desviosMm.length) * 10) / 10 : null,
    dentroPct: movimentos ? Math.round((1 - fora / movimentos) * 100) : null,
    maisFinoMm: motivosFeitos ? nivelSamakaka(motivosFeitos - 1).pontoMm : null,
  };
}
