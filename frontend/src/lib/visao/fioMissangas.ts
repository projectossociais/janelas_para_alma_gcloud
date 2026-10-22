/**
 * Fio de Missangas: o cordão de Brock, com um fio e missangas a sério, e o
 * telemóvel como treinador e régua (desde 2026-10-21, no lugar do Teste de
 * Contraste).
 *
 * Com a ponta do fio no nariz, a olhar para uma missanga, quem tem os dois
 * olhos a trabalhar vê dois fios a cruzarem-se nessa missanga (em X): cada
 * olho vê o fio de um lado. Se o X fica antes da missanga, os olhos juntam-se
 * demais; depois, de menos; um fio só, o cérebro está a ignorar um olho
 * (supressão). No fim mede-se o ponto mais próximo de convergência (PPC): a
 * missanga aproxima-se do nariz até ficar a dobrar, e o ecrã, calibrado com
 * o cartão, serve de régua.
 *
 * Funções puras -- o ecrã vive em `pages/exercises/FioMissangas.tsx`.
 */

export type RespostaFio = "x" | "antes" | "depois" | "um";
export const RESPOSTAS_FIO: readonly RespostaFio[] = ["x", "antes", "depois", "um"];

export interface Missanga {
  cor: "vermelha" | "amarela" | "verde";
  hex: string;
  onde: "perto" | "meio" | "longe";
}
export const MISSANGAS: readonly Missanga[] = [
  { cor: "vermelha", hex: "#c0392b", onde: "perto" },
  { cor: "amarela", hex: "#e3a21a", onde: "meio" },
  { cor: "verde", hex: "#2f7d4f", onde: "longe" },
];

/** Tempo a segurar o X em cada missanga. */
export const SEGUNDOS_SEGURAR = 10;
/** Medições do ponto mais próximo (usa-se a média). */
export const MEDICOES_PPC = 2;
/** Referências do PPC em crianças e adultos sem queixas: até ~6 cm; acima de 10 cm é frequente na insuficiência de convergência. */
export const PPC_ESPERADO_CM = 6;
export const PPC_ALTO_CM = 10;
/** Zero da régua: um pouco abaixo do topo do ecrã. */
export const ZERO_REGUA_PX = 28;

/** Centímetros na régua, a partir da linha do zero, arredondados a meio centímetro. */
export function cmNaRegua(yPx: number, pxPorMm: number, zeroPx = ZERO_REGUA_PX): number {
  const cm = Math.max(0, (yPx - zeroPx) / pxPorMm / 10);
  return Math.round(cm * 2) / 2;
}

export type ClassePpc = "esperado" | "limite" | "alto";

export const classeDoPpc = (cm: number | null): ClassePpc => (cm === null || cm > PPC_ALTO_CM ? "alto" : cm <= PPC_ESPERADO_CM ? "esperado" : "limite");

export interface ResumoFio {
  /** Algum fio desapareceu: um olho a ser ignorado. */
  supressao: boolean;
  /** Missangas com o X no sítio. */
  xNoSitio: number;
  /** Média das medições dentro da régua; `null` se todas ficaram para lá dela. */
  ppcCm: number | null;
  /** Alguma medição ficou mais longe do que a régua. */
  alemDaRegua: boolean;
  classe: ClassePpc;
}

/** `ppc`: cada medição em cm, ou `null` quando ficou mais longe do que a régua. */
export function resumirFio(respostas: readonly RespostaFio[], ppc: readonly (number | null)[]): ResumoFio {
  const dentro = ppc.filter((v): v is number => v !== null);
  const alemDaRegua = dentro.length < ppc.length;
  // Se alguma medição passou da régua, a média das outras subestima: conta como acima.
  const ppcCm = !alemDaRegua && dentro.length ? Math.round((dentro.reduce((a, b) => a + b, 0) / dentro.length) * 10) / 10 : null;
  return {
    supressao: respostas.includes("um"),
    xNoSitio: respostas.filter((r) => r === "x").length,
    ppcCm,
    alemDaRegua,
    classe: classeDoPpc(ppcCm),
  };
}

/**
 * Os dois fios no desenho de cada resposta (72 x 100): saem dos olhos (em
 * baixo) e cruzam-se à altura `yCruz`; a missanga está a meio (y = 46).
 */
export function linhasDoFio(r: RespostaFio): { x1: number; y1: number; x2: number; y2: number }[] {
  if (r === "um") return [{ x1: 36, y1: 96, x2: 36, y2: 4 }];
  const yCruz = { x: 46, antes: 66, depois: 26 }[r];
  const alcance = (20 * (96 - 4)) / (96 - yCruz);
  return [
    { x1: 16, y1: 96, x2: 16 + alcance, y2: 4 },
    { x1: 56, y1: 96, x2: 56 - alcance, y2: 4 },
  ];
}
