/**
 * Kianda com tapa-olho: pesca no mar da Ilha de Luanda com o olho mais forte
 * tapado (a mão ou um pano chegam). É o modo principal do Kianda desde
 * 2026-10-21 -- a maior parte das famílias não tem óculos 3D.
 *
 * - O tapa-olho é o tratamento padrão da ambliopia; o jogo dá à criança uma
 *   razão para o manter.
 * - Aprendizagem perceptual no olho fraco: as escamas dos peixes são riscas
 *   (grelha sinusoidal) e só se apanham os peixes com as riscas inclinadas
 *   como o sinal da Kianda. A diferença de inclinação entre o peixe certo e
 *   os outros desce em escada (2 certos -> mais difícil, 1 errado -> mais
 *   fácil), como no modo com óculos.
 * - Níveis: a cada `CERTOS_POR_NIVEL` peixes certos, peixes mais pequenos,
 *   riscas mais finas e mais esbatidas, e um sinal novo.
 *
 * Funções puras -- o desenho e o tempo vivem em `components/visao/PescaKianda.tsx`.
 */
import type { Rng } from "./escada";
import { FACTOR_DIFICIL, FACTOR_FACIL, JANELA_ORIENTACAO, ORIENTACAO_INICIAL, ORIENTACAO_MAX, ORIENTACAO_MIN } from "./kianda";

export interface NivelPesca {
  /** Comprimento do peixe, no ecrã. */
  peixeMm: number;
  /** Período das riscas (uma clara e uma escura), no ecrã. */
  periodoMm: number;
  /** Contraste das riscas, 0-1. */
  contraste: number;
  velocidadeMmS: number;
  /** Intervalo médio entre peixes. */
  intervaloS: number;
}

export const NIVEIS_PESCA: readonly NivelPesca[] = [
  { peixeMm: 13, periodoMm: 1.7, contraste: 0.85, velocidadeMmS: 9, intervaloS: 1.05 },
  { peixeMm: 12, periodoMm: 1.5, contraste: 0.75, velocidadeMmS: 10.5, intervaloS: 0.98 },
  { peixeMm: 11, periodoMm: 1.35, contraste: 0.66, velocidadeMmS: 12, intervaloS: 0.92 },
  { peixeMm: 10, periodoMm: 1.2, contraste: 0.56, velocidadeMmS: 13.5, intervaloS: 0.86 },
  { peixeMm: 9, periodoMm: 1.05, contraste: 0.46, velocidadeMmS: 15, intervaloS: 0.8 },
];

/** Peixes certos para subir de nível. */
export const CERTOS_POR_NIVEL = 8;
/** Fracção de peixes com as riscas do sinal. */
export const FRACCAO_CERTOS_PESCA = 0.45;
/** Inclinações possíveis do sinal, em graus. */
export const ALVOS_PESCA: readonly number[] = [0, 30, 45, 60, 90, 120, 135, 150];

export type EventoPesca = "certo" | "errado" | "fugiu" | "alforreca";

export interface EstadoPesca {
  /** 1 a `NIVEIS_PESCA.length`. */
  nivel: number;
  /** Inclinação do sinal, em graus. */
  alvo: number;
  /** Diferença de inclinação entre o peixe certo e os outros, em graus. */
  diferenca: number;
  certosSeguidos: number;
  certosNoNivel: number;
  /** Diferenças nos últimos peixes apanhados (certos ou não). */
  diferencas: readonly number[];
  totais: { certos: number; errados: number; fugidos: number; alforrecas: number };
}

const arred1 = (x: number) => Math.round(x * 10) / 10;
export const norm180 = (a: number) => ((a % 180) + 180) % 180;

/** Um sinal novo, sempre diferente do actual. */
export function outroAlvo(actual: number | null, rng: Rng = Math.random): number {
  const opcoes = ALVOS_PESCA.filter((a) => a !== actual);
  return opcoes[Math.floor(rng() * opcoes.length)];
}

export function iniciarPesca(rng: Rng = Math.random): EstadoPesca {
  return {
    nivel: 1,
    alvo: outroAlvo(null, rng),
    diferenca: ORIENTACAO_INICIAL,
    certosSeguidos: 0,
    certosNoNivel: 0,
    diferencas: [],
    totais: { certos: 0, errados: 0, fugidos: 0, alforrecas: 0 },
  };
}

/** Inclinação das riscas de um peixe novo: a do sinal, ou desviada da diferença actual. */
export const orientacaoDoPeixe = (e: EstadoPesca, certo: boolean, rng: Rng = Math.random): number =>
  certo ? e.alvo : norm180(e.alvo + (rng() < 0.5 ? -1 : 1) * e.diferenca);

/**
 * Um acontecimento do jogo. Os peixes que fogem e as alforrecas não mexem na
 * escada: só os peixes apanhados dizem se o olho distingue a inclinação.
 */
export function registarPesca(e: EstadoPesca, ev: EventoPesca, rng: Rng = Math.random): EstadoPesca {
  const totais = { ...e.totais };
  switch (ev) {
    case "fugiu":
      return { ...e, totais: { ...totais, fugidos: totais.fugidos + 1 } };
    case "alforreca":
      return { ...e, totais: { ...totais, alforrecas: totais.alforrecas + 1 } };
    case "errado":
      return {
        ...e,
        certosSeguidos: 0,
        diferenca: Math.min(ORIENTACAO_MAX, arred1(e.diferenca * FACTOR_FACIL)),
        diferencas: [...e.diferencas, e.diferenca].slice(-JANELA_ORIENTACAO),
        totais: { ...totais, errados: totais.errados + 1 },
      };
    case "certo": {
      let { certosSeguidos, diferenca, nivel, certosNoNivel, alvo } = e;
      const diferencas = [...e.diferencas, diferenca].slice(-JANELA_ORIENTACAO);
      certosSeguidos += 1;
      if (certosSeguidos >= 2) {
        diferenca = Math.max(ORIENTACAO_MIN, arred1(diferenca * FACTOR_DIFICIL));
        certosSeguidos = 0;
      }
      certosNoNivel += 1;
      if (certosNoNivel >= CERTOS_POR_NIVEL && nivel < NIVEIS_PESCA.length) {
        nivel += 1;
        certosNoNivel = 0;
        alvo = outroAlvo(alvo, rng);
      }
      return {
        ...e,
        nivel,
        alvo,
        certosSeguidos,
        certosNoNivel,
        diferenca,
        diferencas,
        totais: { ...totais, certos: totais.certos + 1 },
      };
    }
  }
}

/**
 * Diferença de inclinação que o olho fraco já distingue: mediana das
 * diferenças nos últimos peixes apanhados. `null` sem nenhum.
 */
export function limiarPesca(e: EstadoPesca): number | null {
  if (!e.diferencas.length) return null;
  const o = [...e.diferencas].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return arred1(o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2);
}

export interface Caixa {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

/**
 * Qual caixa (peixe) foi tocada: a de cima (a última desenhada), com uma
 * folga à volta para dedos de criança. -1 se nenhuma.
 */
export function caixaTocada(caixas: readonly Caixa[], x: number, y: number, folga: number): number {
  for (let i = caixas.length - 1; i >= 0; i--) {
    const c = caixas[i];
    if (x >= c.x - folga && x <= c.x + c.largura + folga && y >= c.y - folga && y <= c.y + c.altura + folga) return i;
  }
  return -1;
}

/** Percentagem de peixes apanhados que eram os certos; `null` sem nenhum. */
export function precisaoPesca(e: EstadoPesca): number | null {
  const n = e.totais.certos + e.totais.errados;
  return n ? Math.round((e.totais.certos / n) * 100) : null;
}
