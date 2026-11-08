/**
 * Fio de Missangas: o ponto mais próximo de convergência (PPC) medido só com
 * o telemóvel (versão 2, desde 2026-10-31; a versão 1, de 2026-10-21, era o
 * cordão de Brock com um fio e missangas a sério).
 *
 * O telemóvel fica deitado, de ecrã para cima, com a ponta de baixo
 * encostada ao nariz -- faz de régua RAF. Uma missanga desce pelo fio
 * desenhado no ecrã, 1 cm por segundo; a pessoa olha só para ela e toca
 * quando a vê a dobrar (rotura). A missanga volta a afastar-se e toca-se
 * quando volta a ser uma (recuperação). Três rondas; o PPC é a média das
 * roturas. Com o ecrã calibrado pelo cartão, o telemóvel sabe onde estava a
 * missanga e mede sozinho.
 *
 * A distância conta a partir do fundo da página (a ponta do telemóvel, em
 * ecrã inteiro); no consultório conta dos olhos. A Fase 0 da validação
 * compara com a régua RAF e diz se é precisa uma correcção fixa.
 *
 * Funções puras -- o ecrã vive em `pages/exercises/FioMissangas.tsx`.
 */

export interface Missanga {
  cor: "vermelha" | "amarela" | "verde";
  hex: string;
}
/** Uma cor por ronda. */
export const MISSANGAS: readonly Missanga[] = [
  { cor: "vermelha", hex: "#c0392b" },
  { cor: "amarela", hex: "#e3a21a" },
  { cor: "verde", hex: "#2f7d4f" },
];

export const RONDAS = MISSANGAS.length;
/** A velocidade da régua RAF no consultório. */
export const VELOCIDADE_CM_S = 1;
/** Referências do PPC em crianças e adultos sem queixas: até ~6 cm; acima de 10 cm é frequente na insuficiência de convergência. */
export const PPC_ESPERADO_CM = 6;
export const PPC_ALTO_CM = 10;
/** Num ecrã grande (tablet), a missanga não parte de mais longe do que isto. */
export const INICIO_MAX_CM = 20;
/** A barra "encoste aqui ao nariz", no fundo do ecrã: a missanga que lá chega chegou ao nariz. */
export const NARIZ_MM = 8;
/** Espaço livre no topo do ecrã, acima do ponto de partida. */
export const TOPO_PX = 28;
/** Quanto mais longe tem de ficar a última rotura do que a primeira para contar como cansaço. */
export const CANSACO_CM = 3;

export const meioCm = (cm: number): number => Math.round(cm * 2) / 2;

/** De onde parte a missanga, em cm a partir do fundo do ecrã: o mais alto que o ecrã deixa, a meio centímetro. */
export function inicioDaMissanga(alturaPx: number, pxPorMm: number): number {
  const cm = Math.floor(((alturaPx - TOPO_PX) / pxPorMm / 10) * 2) / 2;
  return Math.max(NARIZ_MM / 10, Math.min(INICIO_MAX_CM, cm));
}

/** Altura (px, a contar do topo) de um ponto a `cm` do fundo do ecrã. */
export const yDoCm = (cm: number, alturaPx: number, pxPorMm: number): number => alturaPx - cm * 10 * pxPorMm;

/** Onde está a missanga ao fim de `segundos`, a descer ou a subir a partir de `desde`. Nunca passa do nariz nem do início. */
export function posicaoDaMissanga(desde: number, segundos: number, sentido: "aproximar" | "afastar", inicioCm: number): number {
  const cm = sentido === "aproximar" ? desde - VELOCIDADE_CM_S * segundos : desde + VELOCIDADE_CM_S * segundos;
  return Math.max(NARIZ_MM / 10, Math.min(inicioCm, cm));
}

export interface RondaFio {
  /** Onde ficou a dobrar (cm); 0 = chegou ao nariz sem ficar a dobrar. */
  rotura: number;
  /** Onde voltou a ser uma (cm); `null` = chegou ao início sem voltar a ser uma. */
  recuperacao: number | null;
  /** Já estava a dobrar ao partir: o PPC fica mais longe do que o ecrã. */
  alem: boolean;
}

/** Uma rotura tocada logo à partida (no primeiro meio centímetro) conta como mais longe do que o ecrã. */
export const roturaAlem = (rotura: number, inicioCm: number): boolean => rotura >= inicioCm - 0.5;

export type ClassePpc = "esperado" | "limite" | "alto";

export const classeDoPpc = (cm: number | null): ClassePpc => (cm === null || cm > PPC_ALTO_CM ? "alto" : cm <= PPC_ESPERADO_CM ? "esperado" : "limite");

export interface ResumoFio {
  /** Média das roturas; `null` se alguma ficou para lá do ecrã (a média das outras subestimava). */
  ppcCm: number | null;
  /** Média das recuperações; `null` se alguma não voltou a ser uma dentro do ecrã. */
  recuperacaoCm: number | null;
  /** Em todas as rondas chegou ao nariz sem ficar a dobrar. */
  chegouAoNariz: boolean;
  alemDoEcra: boolean;
  /** A última rotura ficou `CANSACO_CM` ou mais longe do que a primeira. */
  cansaco: boolean;
  classe: ClassePpc;
}

const media = (xs: readonly number[]): number => Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10;

export function resumirFio(rondas: readonly RondaFio[]): ResumoFio {
  const alemDoEcra = rondas.some((r) => r.alem);
  const ppcCm = !rondas.length || alemDoEcra ? null : media(rondas.map((r) => r.rotura));
  const recs = rondas.map((r) => r.recuperacao);
  const recuperacaoCm = !recs.length || recs.some((r) => r === null) ? null : media(recs as number[]);
  const primeira = rondas[0];
  const ultima = rondas[rondas.length - 1];
  return {
    ppcCm,
    recuperacaoCm,
    chegouAoNariz: rondas.length > 0 && rondas.every((r) => r.rotura === 0),
    alemDoEcra,
    cansaco: rondas.length >= 2 && !ultima.alem && ultima.rotura - primeira.rotura >= CANSACO_CM,
    classe: classeDoPpc(ppcCm),
  };
}
