import type { Transition } from "motion/react";

/**
 * Vocabulário de movimento (docs/PESQUISA_UX.md §3 e §6; SISTEMA_DESIGN §5).
 * Os componentes usam só estes valores, nunca números soltos.
 */

/** Durações, em segundos (o `motion` usa segundos; o CSS tem as mesmas em ms). */
export const DURACAO = {
  /** Resposta a um toque, hover, pressão. */
  feedback: 0.1,
  /** Mudar de passo, abrir um painel. */
  transicao: 0.25,
  /** Entrada de secção, celebração curta. */
  entrada: 0.4,
} as const;

/** Curva por omissão das transições com duração: sai depressa, pousa devagar. */
export const CURVA = [0.2, 0, 0, 1] as const;

/**
 * Molas. `tarefa` é a de todos os ecrãs de tarefa: amortecimento perto do
 * crítico, sem ressalto. `celebracao` pode ressaltar um pouco, e só se usa
 * nos momentos do catálogo (PESQUISA_UX §6).
 */
export const MOLA = {
  tarefa: { type: "spring", stiffness: 260, damping: 32, mass: 1 },
  celebracao: { type: "spring", stiffness: 300, damping: 22, mass: 1 },
} as const satisfies Record<string, Transition>;

/** Razão de amortecimento de uma mola (1 = crítico, sem ressalto). */
export const razaoAmortecimento = (m: { stiffness: number; damping: number; mass: number }) =>
  m.damping / (2 * Math.sqrt(m.stiffness * m.mass));

/** Transições prontas, para não haver combinações soltas pelo código. */
export const TRANSICAO = {
  feedback: { duration: DURACAO.feedback, ease: CURVA },
  passo: MOLA.tarefa,
  desvanecer: { duration: DURACAO.transicao, ease: CURVA },
  entrada: { duration: DURACAO.entrada, ease: CURVA },
} as const satisfies Record<string, Transition>;
