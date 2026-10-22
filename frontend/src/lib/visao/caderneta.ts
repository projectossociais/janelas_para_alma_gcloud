/**
 * Caderneta do Tapa-olho: acompanha as horas de tapa-olho, o tratamento da
 * ambliopia que acontece longe do ecrã (desde 2026-10-21, no lugar do Treino
 * Perto e longe).
 *
 * Não é um exercício para olhar para o telemóvel: conta o tempo enquanto a
 * criança brinca, pergunta de 15 em 15 minutos se o tapa-olho continua posto
 * (só conta o tempo confirmado) e dá um cromo por cada dia em que se cumpriu
 * o tempo receitado. Cada período fica gravado como uma sessão, e o médico vê
 * quantas horas foram feitas de verdade -- a adesão é o que mais decide o
 * resultado do tapa-olho.
 *
 * Funções puras -- o ecrã vive em `pages/exercises/CadernetaTapaOlho.tsx`.
 */
import { diaLocal, ultimosDias } from "./progresso";
import type { Olho } from "./resultados";

/** Tempos receitados mais comuns, em minutos por dia. */
export const ALVOS_MIN = [60, 120, 240, 360] as const;
export const ALVO_OMISSAO_MIN = 120;
/** De quanto em quanto tempo se pergunta se o tapa-olho continua posto. */
export const VERIFICAR_CADA_MIN = 15;
/** Cromos na caderneta (um por dia cumprido; depois recomeça). */
export const TOTAL_CROMOS = 30;
export const MODO_TAPA_OLHO = "tapa_olho_horas";

/** Um período de tapa-olho em curso (guardado no aparelho, para sobreviver a fechar a página). */
export interface PeriodoTapa {
  inicio: number;
  /** Até quando o tapa-olho está confirmado como posto (ms). */
  confirmadoAte: number;
  alvoMin: number;
  verificacoes: number;
  /** O olho tapado é o mais forte; este é o que trabalha. */
  olhoTreinado: Olho | null;
}

export const iniciarPeriodo = (agora: number, alvoMin: number, olhoTreinado: Olho | null): PeriodoTapa => ({
  inicio: agora,
  confirmadoAte: agora,
  alvoMin,
  verificacoes: 0,
  olhoTreinado,
});

/** Já passou o tempo de perguntar se continua posto? */
export const precisaVerificar = (p: PeriodoTapa, agora: number): boolean => agora - p.confirmadoAte >= VERIFICAR_CADA_MIN * 60_000;

/** "Sim, está posto": o tempo até agora conta. */
export const confirmar = (p: PeriodoTapa, agora: number): PeriodoTapa => ({ ...p, confirmadoAte: agora, verificacoes: p.verificacoes + 1 });

/**
 * Segundos que contam: até agora se ainda não é hora de perguntar; se já é
 * (ou se a página esteve fechada muito tempo), só até à última confirmação.
 */
export const segundosContados = (p: PeriodoTapa, agora: number): number =>
  Math.max(0, Math.round(((precisaVerificar(p, agora) ? p.confirmadoAte : agora) - p.inicio) / 1000));

interface SessaoComTapa {
  created_at: string;
  segundos_activos: number | null;
  sinais: Record<string, unknown> | null;
}

export const eSessaoDeTapa = (s: SessaoComTapa): boolean => s.sinais?.modo === MODO_TAPA_OLHO;

/** Minutos de tapa-olho por dia (`AAAA-MM-DD`), das sessões gravadas. */
export function minutosDeTapaPorDia(sessoes: readonly SessaoComTapa[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const s of sessoes) {
    if (!eSessaoDeTapa(s)) continue;
    const dia = diaLocal(new Date(s.created_at));
    out.set(dia, (out.get(dia) ?? 0) + (s.segundos_activos ?? 0) / 60);
  }
  return out;
}

/** Os dias em que se cumpriu o tempo receitado, do mais antigo para o mais recente. */
export const diasCumpridos = (porDia: Map<string, number>, alvoMin: number): string[] =>
  [...porDia.entries()].filter(([, m]) => m >= alvoMin).map(([d]) => d).sort();

/** O cromo de um dia cumprido: o 1.º dia dá o cromo 0, e assim por diante (a caderneta recomeça ao fim de 30). */
export const cromoDoDia = (n: number): number => n % TOTAL_CROMOS;

/** Minutos em horas e minutos, arredondando primeiro: 119,6 min dá 2 h 00, não 1 h 60. */
export function horasEMinutos(min: number): { h: number; m: number } {
  const total = Math.round(min);
  return { h: Math.floor(total / 60), m: total % 60 };
}

export interface ResumoSemana {
  /** Minutos de cada um dos últimos 7 dias, do mais antigo para hoje. */
  minutos: number[];
  mediaMin: number;
  /** Percentagem do tempo receitado (média dos 7 dias). */
  pctDoReceitado: number;
  cumpridos: number;
}

export function resumoSemana(porDia: Map<string, number>, alvoMin: number, hoje: Date): ResumoSemana {
  const minutos = ultimosDias(hoje, 7).map((d) => Math.round(porDia.get(d) ?? 0));
  const mediaMin = Math.round(minutos.reduce((a, b) => a + b, 0) / 7);
  return {
    minutos,
    mediaMin,
    pctDoReceitado: alvoMin ? Math.round((mediaMin / alvoMin) * 100) : 0,
    cumpridos: minutos.filter((m) => m >= alvoMin).length,
  };
}

const CHAVE_PERIODO = "jpa.visao.caderneta.periodo";
const CHAVE_ALVO = "jpa.visao.caderneta.alvo";

export function lerPeriodo(): PeriodoTapa | null {
  try {
    const v = JSON.parse(window.localStorage.getItem(CHAVE_PERIODO) ?? "null");
    return v && typeof v.inicio === "number" && typeof v.confirmadoAte === "number" ? (v as PeriodoTapa) : null;
  } catch {
    return null;
  }
}

export function guardarPeriodo(p: PeriodoTapa | null): void {
  try {
    if (p) window.localStorage.setItem(CHAVE_PERIODO, JSON.stringify(p));
    else window.localStorage.removeItem(CHAVE_PERIODO);
  } catch {
    // armazenamento bloqueado: o período só dura enquanto a página estiver aberta
  }
}

export function lerAlvo(): number {
  try {
    const v = Number(window.localStorage.getItem(CHAVE_ALVO));
    return (ALVOS_MIN as readonly number[]).includes(v) ? v : ALVO_OMISSAO_MIN;
  } catch {
    return ALVO_OMISSAO_MIN;
  }
}

export function guardarAlvo(min: number): void {
  try {
    window.localStorage.setItem(CHAVE_ALVO, String(min));
  } catch {
    // armazenamento bloqueado
  }
}
