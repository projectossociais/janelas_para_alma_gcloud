/**
 * Caderneta do Tapa-olho: acompanha as horas de tapa-olho, o tratamento da
 * ambliopia que acontece longe do ecrã (desde 2026-10-21, no lugar do Treino
 * Perto e longe).
 *
 * Não é um exercício para olhar para o telemóvel: a família toca em Pôr quando
 * põe o tapa-olho e em Tirar quando o tira, e o tempo pode ser feito aos
 * bocados ao longo do dia. Dá um cromo por cada dia em que se cumpriu o tempo
 * receitado. Cada bocado fica gravado como uma sessão, e o médico vê quantas
 * horas foram feitas -- a adesão é o que mais decide o resultado do tapa-olho.
 *
 * Versão 2 (2026-11-01): o tempo receitado escolhe-se entre os mais comuns
 * (2 h por dia na ambliopia moderada, 6 h na grave -- estudos PEDIG, 2003) ou
 * outro em passos de 30 min; a pergunta de 15 em 15 minutos "continua posto?"
 * passa a opcional (desligada à partida); ao tirar, corrige-se a hora se o
 * tirou antes e se esqueceu; e o tempo feito sem o telemóvel acrescenta-se à
 * mão (`sinais.manual`), à parte no relatório. A versão 1 perguntava sempre.
 *
 * Funções puras -- o ecrã vive em `pages/exercises/CadernetaTapaOlho.tsx`.
 */
import { diaLocal, ultimosDias } from "./progresso";
import type { Olho } from "./resultados";

/** Tempos receitados mais comuns, em minutos por dia: 2 h (ambliopia moderada) e 6 h (grave). */
export const ALVOS_MIN = [120, 360] as const;
export const ALVO_OMISSAO_MIN = 120;
/** "Outro tempo": de 30 min a 12 h, em passos de 30 min. */
export const ALVO_MINIMO_MIN = 30;
export const ALVO_MAXIMO_MIN = 720;
export const PASSO_ALVO_MIN = 30;
/** Ao tirar, quanto tempo antes o pode ter tirado (só aparecem os mais curtos do que o bocado). */
export const TIRADO_ANTES_MIN = [15, 30, 60] as const;
/** Bocados a partir dos quais se pergunta "tirou-o agora?" ao tirar. */
export const PERGUNTAR_AO_TIRAR_MIN = 30;
/** Tempo feito sem o telemóvel, para acrescentar à mão. */
export const ACRESCENTAR_MIN = [30, 60, 90, 120, 180] as const;
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
  /** Pergunta-se de 15 em 15 min se continua posto? (Os períodos da versão 1, sem o campo, perguntavam.) */
  verificar?: boolean;
  /** O olho tapado é o mais forte; este é o que trabalha. */
  olhoTreinado: Olho | null;
}

export const iniciarPeriodo = (agora: number, alvoMin: number, olhoTreinado: Olho | null, verificar = false): PeriodoTapa => ({
  inicio: agora,
  confirmadoAte: agora,
  alvoMin,
  verificacoes: 0,
  verificar,
  olhoTreinado,
});

/** Já passou o tempo de perguntar se continua posto? Nunca, com a pergunta desligada. */
export const precisaVerificar = (p: PeriodoTapa, agora: number): boolean =>
  p.verificar !== false && agora - p.confirmadoAte >= VERIFICAR_CADA_MIN * 60_000;

/** "Sim, está posto": o tempo até agora conta. */
export const confirmar = (p: PeriodoTapa, agora: number): PeriodoTapa => ({ ...p, confirmadoAte: agora, verificacoes: p.verificacoes + 1 });

/**
 * Segundos que contam: até agora se ainda não é hora de perguntar; se já é
 * (ou se a página esteve fechada muito tempo), só até à última confirmação.
 */
export const segundosContados = (p: PeriodoTapa, agora: number): number =>
  Math.max(0, Math.round(((precisaVerificar(p, agora) ? p.confirmadoAte : agora) - p.inicio) / 1000));

/** Ao tirar: os segundos que contam, menos os minutos que já estava tirado ("tirei há 15 min"). */
export const segundosAoTirar = (p: PeriodoTapa, agora: number, tiradoAntesMin = 0): number =>
  Math.max(0, segundosContados(p, agora) - tiradoAntesMin * 60);

/** O "tirei há..." que fazem sentido para um bocado deste tamanho (minutos). */
export const tiradoAntesPossiveis = (minutos: number): number[] => TIRADO_ANTES_MIN.filter((m) => m < minutos);

/** Um tempo receitado dentro dos limites, em passos de 30 min. */
export const ajustarAlvo = (min: number): number =>
  Math.min(ALVO_MAXIMO_MIN, Math.max(ALVO_MINIMO_MIN, Math.round(min / PASSO_ALVO_MIN) * PASSO_ALVO_MIN));

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

/** Sessões acrescentadas à mão (tempo feito sem o telemóvel). */
export const eManual = (s: SessaoComTapa): boolean => s.sinais?.manual === true;

/** Minutos acrescentados à mão nos últimos 7 dias (o médico vê-os à parte). */
export function minutosManuaisNaSemana(sessoes: readonly SessaoComTapa[], hoje: Date): number {
  const dias = new Set(ultimosDias(hoje, 7));
  return Math.round(
    sessoes
      .filter((s) => eSessaoDeTapa(s) && eManual(s) && dias.has(diaLocal(new Date(s.created_at))))
      .reduce((a, s) => a + (s.segundos_activos ?? 0) / 60, 0),
  );
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
const CHAVE_VERIFICAR = "jpa.visao.caderneta.verificar";

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

/** O tempo receitado guardado, ou `null` se ainda não foi escolhido (mostra-se a escolha). */
export function lerAlvo(): number | null {
  try {
    const v = Number(window.localStorage.getItem(CHAVE_ALVO));
    return v && ajustarAlvo(v) === v ? v : null;
  } catch {
    return null;
  }
}

export function guardarAlvo(min: number): void {
  try {
    window.localStorage.setItem(CHAVE_ALVO, String(min));
  } catch {
    // armazenamento bloqueado
  }
}

export function lerVerificar(): boolean {
  try {
    return window.localStorage.getItem(CHAVE_VERIFICAR) === "1";
  } catch {
    return false;
  }
}

export function guardarVerificar(v: boolean): void {
  try {
    window.localStorage.setItem(CHAVE_VERIFICAR, v ? "1" : "0");
  } catch {
    // armazenamento bloqueado
  }
}
