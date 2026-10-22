/**
 * Olho Mágico: amplitudes de vergência sem óculos nenhuns (fusão livre).
 *
 * Dois quadros de "pano" -- pontos aleatórios coloridos -- lado a lado. Quem
 * cruza os olhos (convergência) ou os relaxa como a olhar ao longe
 * (divergência) vê um terceiro quadro no meio, e nele uma forma em relevo:
 * peixe, estrela, coração ou casa. Cada quadro sozinho é só ruído, por isso
 * acertar na forma prova que os olhos estão juntos (como nas Pontes de Fusão,
 * mas sem filtros de cor). É o princípio dos cartões de fusão livre da
 * terapia visual, com a fusão verificada pelo próprio estímulo.
 *
 * A procura de vergência é a das Pontes: Δ ≈ 100 · s / D, com s a separação
 * entre os centros dos quadros e D a distância (Régua Invisível). Os
 * quadros não se podem sobrepor, por isso o primeiro degrau já pede uns
 * 5 Δ a 40 cm. Ao alto, um telemóvel só chega a uns 7 Δ: o exercício pede
 * para o deitar (`alargarRampa`).
 *
 * A escada de rotura e recuperação é a de `pontes.ts`.
 *
 * Funções puras -- o desenho vive em `pages/exercises/OlhoMagico.tsx`.
 */
import type { Rng } from "./escada";
import { NIVEIS_DELTA, separacaoMm, type EstadoRampa, type Sentido } from "./pontes";

export type FormaPano = "peixe" | "estrela" | "coracao" | "casa";
export const FORMAS_PANO: readonly FormaPano[] = ["peixe", "estrela", "coracao", "casa"];

/** Pontos por lado de cada quadro. */
export const GRELHA_PANO = 30;
/** Deslocamento da forma entre os dois quadros, em pontos (~1000″ a 40 cm). */
export const DISPARIDADE_PANO = 3;
/** Lado de cada quadro, no ecrã. */
export const QUADRO_PANO_MM = 20;
/** Folga mínima entre os dois quadros. */
export const FOLGA_PANO_MM = 2;
/** Folga de cada lado entre os quadros e a borda do palco. */
export const MARGEM_PANO_MM = 2;
/** Cores do pano (inspiradas nos panos angolanos), em sRGB. */
export const CORES_PANO: readonly string[] = ["#1d1a19", "#b8322a", "#e3a21a", "#2a5c8a", "#f1e6cf", "#2f7d4f"];

/** Respostas certas seguidas, no primeiro degrau, para começar a medir. */
export const PRATICA_SEGUIDAS = 2;
/** Falhas a praticar depois das quais se mostram as dicas outra vez. */
export const FALHAS_PARA_DICAS = 4;

export type ModoOlhoMagico = "cruzar" | "relaxar";
export const sentidoDoModo = (m: ModoOlhoMagico): Sentido => (m === "cruzar" ? "convergencia" : "divergencia");

type Ponto = readonly [number, number];

const naTriangulo = (u: number, v: number, a: Ponto, b: Ponto, c: Ponto): boolean => {
  const lado = (p: Ponto, q: Ponto) => (q[0] - p[0]) * (v - p[1]) - (q[1] - p[1]) * (u - p[0]);
  const d1 = lado(a, b);
  const d2 = lado(b, c);
  const d3 = lado(c, a);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
};

const naPoligono = (u: number, v: number, pts: readonly Ponto[]): boolean => {
  let dentro = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > v !== yj > v && u < ((xj - xi) * (v - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
};

const ESTRELA: readonly Ponto[] = Array.from({ length: 10 }, (_, i) => {
  const r = i % 2 ? 0.18 : 0.42;
  const a = -Math.PI / 2 + (i * Math.PI) / 5;
  return [0.5 + r * Math.cos(a), 0.54 + r * Math.sin(a)] as const;
});

/** A forma contém o ponto (u, v)? Coordenadas do quadro em [0, 1], v para baixo. */
export function dentroDaFormaPano(forma: FormaPano, u: number, v: number): boolean {
  switch (forma) {
    case "peixe": {
      const dx = (u - 0.56) / 0.32;
      const dy = (v - 0.5) / 0.22;
      return dx * dx + dy * dy <= 1 || naTriangulo(u, v, [0.3, 0.5], [0.08, 0.27], [0.08, 0.73]);
    }
    case "estrela":
      return naPoligono(u, v, ESTRELA);
    case "coracao": {
      // (x² + y² - 1)³ - x²y³ <= 0, com y para cima.
      const x = (u - 0.5) * 2.6;
      const y = (0.5 - v) * 2.6 + 0.12;
      const a = x * x + y * y - 1;
      return a * a * a - x * x * y * y * y <= 0;
    }
    case "casa":
      return (u >= 0.26 && u <= 0.74 && v >= 0.46 && v <= 0.86) || naTriangulo(u, v, [0.16, 0.5], [0.5, 0.14], [0.84, 0.5]);
  }
}

/** A forma na grelha de `n` × `n` pontos (1 = dentro), amostrada no centro de cada ponto. */
export function mascaraPano(forma: FormaPano, n = GRELHA_PANO): Uint8Array {
  const m = new Uint8Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) m[y * n + x] = dentroDaFormaPano(forma, (x + 0.5) / n, (y + 0.5) / n) ? 1 : 0;
  return m;
}

/**
 * Par de quadros (índices em `CORES_PANO`): o olho esquerdo vê `esquerdo`, o
 * direito vê `direito`, com a forma deslocada `disp` pontos para a esquerda
 * -- disparidade cruzada, a forma salta para a frente. O fundo que a forma
 * destapa leva pontos novos, para nenhum dos quadros a mostrar sozinho.
 */
export function gerarParPano(
  forma: FormaPano,
  rng: Rng = Math.random,
  n = GRELHA_PANO,
  disp = DISPARIDADE_PANO,
): { esquerdo: Uint8Array; direito: Uint8Array } {
  const m = mascaraPano(forma, n);
  const sorte = () => Math.floor(rng() * CORES_PANO.length);
  const esquerdo = new Uint8Array(n * n);
  const direito = new Uint8Array(n * n);
  for (let i = 0; i < n * n; i++) esquerdo[i] = sorte();
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      const xs = x + disp;
      direito[i] = xs < n && m[y * n + xs] ? esquerdo[y * n + xs] : m[i] ? sorte() : esquerdo[i];
    }
  return { esquerdo, direito };
}

/**
 * Degraus de procura (Δ) para um sentido, a esta distância: o primeiro é o
 * mais perto que os quadros podem estar sem se tocarem (arredondado ao meio
 * Δ acima); depois os degraus das Pontes que ficam pelo menos 1 Δ acima.
 */
export function niveisOlhoMagico(sentido: Sentido, distanciaMm: number): number[] {
  const minimo = Math.ceil((((QUADRO_PANO_MM + FOLGA_PANO_MM) * 100) / distanciaMm) * 2) / 2;
  return [minimo, ...NIVEIS_DELTA[sentido].filter((d) => d >= minimo + 1)];
}

/** Degraus que cabem num palco com esta largura (mm). */
export const niveisQueCabem = (niveis: readonly number[], distanciaMm: number, larguraPalcoMm: number): number[] =>
  niveis.filter((d) => separacaoMm(d, distanciaMm) + QUADRO_PANO_MM + 2 * MARGEM_PANO_MM <= larguraPalcoMm);

/**
 * Depois de rodar o telemóvel cabem mais degraus: a rampa continua um degrau
 * acima de onde estava, como se a última resposta certa tivesse subido.
 * Sem degraus novos (ou já a descer), fica como está.
 */
export function alargarRampa(e: EstadoRampa, novoTotal: number): EstadoRampa {
  if (e.terminado || e.fase !== "subir" || novoTotal <= e.indice + 1) return e;
  return { ...e, total: novoTotal, indice: e.indice + 1, errosSeguidos: 0 };
}

const CHAVE_MODO = "jpa.visao.olhoMagico.modo";

export function lerModoOlhoMagico(): ModoOlhoMagico {
  try {
    const v = window.localStorage.getItem(CHAVE_MODO);
    return v === "relaxar" ? "relaxar" : "cruzar";
  } catch {
    return "cruzar";
  }
}

export function guardarModoOlhoMagico(m: ModoOlhoMagico): void {
  try {
    window.localStorage.setItem(CHAVE_MODO, m);
  } catch {
    // armazenamento bloqueado: pergunta-se outra vez
  }
}
