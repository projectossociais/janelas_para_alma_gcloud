/**
 * Olhos de Palanca ao longe: acuidade de cada olho a 3 metros, como no
 * consultório, sem óculos nem câmara (desde 2026-10-21).
 *
 * A criança fica a 3 m (ou 2 m numa sala pequena) e responde com a mão:
 * aponta para onde apontam os "dedos" da mãozinha (o E de Snellen a rodar,
 * usado nas consultas de todo o mundo com quem ainda não lê). Um adulto
 * segura o telemóvel virado para ela e desliza o dedo no ecrã nesse sentido
 * -- não precisa de ver o ecrã: o lado para onde a criança aponta é o mesmo
 * lado do ecrã, visto por ela. Pode também responder em voz alta, se o
 * aparelho reconhecer a fala.
 *
 * A escada e o limiar anel a anel são os do teste de acuidade
 * (`escada.ts`: 3 por nível, passa com 2).
 *
 * Funções puras -- o ecrã vive em `pages/exercises/TesteAcuidade.tsx`.
 */
import type { Rng } from "./escada";
import { NIVEIS_TESTE_ACUIDADE, aberturaPx, desenhavel } from "./geometria";

export type DireccaoE = "direita" | "baixo" | "esquerda" | "cima";
/** Pela ordem da rotação: 0°, 90°, 180°, 270° (dedos para a direita a 0°). */
export const DIRECCOES_E: readonly DireccaoE[] = ["direita", "baixo", "esquerda", "cima"];
export type RespostaE = DireccaoE | "naosabe";

export const DISTANCIAS_LONGE_MM = [3000, 2000] as const;
export type DistanciaLonge = (typeof DISTANCIAS_LONGE_MM)[number];
/** O E nunca passa desta fracção do lado mais curto do ecrã. */
export const FRACCAO_MAX_ECRA = 0.85;
/** Deslocamento mínimo do dedo (px CSS) para contar como deslizar. */
export const DESLIZE_MIN_PX = 30;
/** Carregar sem deslizar durante este tempo = "não sabe". */
export const PRESSAO_LONGA_MS = 900;
/** Primeiro nível: 0,7 logMAR (6/30), grande o bastante para quase todos. */
export const LOGMAR_INICIAL_LONGE = 0.7;

/** Lado do E (5 traços) em px CSS, para um logMAR a esta distância. */
export const ladoDoEPx = (logmar: number, distanciaMm: number, pxPorMm: number): number =>
  5 * aberturaPx(logmar, distanciaMm, pxPorMm);

/** Os níveis que este ecrã desenha a esta distância: traço visível e E a caber no ecrã. */
export const niveisPalancaLonge = (distanciaMm: number, pxPorMm: number, dpr: number, ladoMaxPx: number): number[] =>
  NIVEIS_TESTE_ACUIDADE.filter(
    (l) => desenhavel(aberturaPx(l, distanciaMm, pxPorMm), dpr) && ladoDoEPx(l, distanciaMm, pxPorMm) <= ladoMaxPx,
  );

/** Direcção de um deslize; `null` se o dedo quase não andou. */
export function direccaoDoGesto(dx: number, dy: number, minimo = DESLIZE_MIN_PX): DireccaoE | null {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.hypot(dx, dy) < minimo) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "direita" : "esquerda";
  return dy > 0 ? "baixo" : "cima";
}

/** Uma direcção nova, nunca igual à anterior. */
export function direccaoAleatoriaE(anterior: DireccaoE | null, rng: Rng = Math.random): DireccaoE {
  const opcoes = DIRECCOES_E.filter((d) => d !== anterior);
  return opcoes[Math.floor(rng() * opcoes.length)];
}

const PALAVRAS: Record<DireccaoE, readonly string[]> = {
  cima: ["cima", "up"],
  baixo: ["baixo", "down"],
  esquerda: ["esquerda", "esquerdo", "left"],
  direita: ["direita", "direito", "right"],
};

/**
 * O que a criança disse, em português ou inglês: "para cima", "esquerda",
 * "não sei"... Duas direcções na mesma frase não contam (a criança hesitou):
 * devolve `null`, e a resposta fica para o deslize do adulto.
 */
export function direccaoDaFala(texto: string): RespostaE | null {
  const limpo = texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  if (/\bnao (sei|vejo)\b|\bdon'?t know\b|\bcan'?t see\b/.test(limpo)) return "naosabe";
  const palavras = new Set(limpo.split(/[^a-z']+/).filter(Boolean));
  const ditas = DIRECCOES_E.filter((d) => PALAVRAS[d].some((p) => palavras.has(p)));
  return ditas.length === 1 ? ditas[0] : null;
}

const CHAVE_DISTANCIA = "jpa.visao.palanca.distancia";

export function lerDistanciaLonge(): DistanciaLonge {
  try {
    return Number(window.localStorage.getItem(CHAVE_DISTANCIA)) === 2000 ? 2000 : 3000;
  } catch {
    return 3000;
  }
}

export function guardarDistanciaLonge(mm: DistanciaLonge): void {
  try {
    window.localStorage.setItem(CHAVE_DISTANCIA, String(mm));
  } catch {
    // armazenamento bloqueado: fica a de omissão
  }
}
