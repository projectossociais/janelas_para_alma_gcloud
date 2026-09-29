/**
 * Contas de progresso a partir do histórico de sessões (versão 2): minutos
 * activos por dia, sequência de dias e o que conta para a dose do treino.
 *
 * Datas no fuso local do utilizador -- "hoje" é o dia do calendário dele.
 */

export interface SessaoResumo {
  exercicio_id: string;
  created_at: string;
  segundos_activos: number | null;
  olho: string | null;
  limiar: number | null;
  unidade: string | null;
  sinais: Record<string, unknown> | null;
}

/** Ids que são treinos (contam para a dose e para a sequência). */
export const IDS_TREINOS = ["ambliopia", "sacadas-convergencia", "convergence", "flexibilidade-acomodativa"];
/**
 * Treinos cujo resultado depende só do que o utilizador declara ("Vejo 1",
 * "Nítido") -- não são medições e aparecem marcados como auto-avaliação.
 */
export const IDS_AUTOAVALIACAO = ["convergence", "flexibilidade-acomodativa"];
/** Ids que são testes de triagem. */
export const IDS_TESTES = ["figure8", "cerebro", "relax", "estereopsia"];

/** `AAAA-MM-DD` no fuso local. */
export function diaLocal(data: Date): string {
  const a = data.getFullYear();
  const m = String(data.getMonth() + 1).padStart(2, "0");
  const d = String(data.getDate()).padStart(2, "0");
  return `${a}-${m}-${d}`;
}

/** Uma sessão marcada como baixa atenção não conta para a dose. */
export const contaParaDose = (s: SessaoResumo): boolean =>
  IDS_TREINOS.includes(s.exercicio_id) && s.sinais?.baixa_atencao !== true;

/** Minutos activos de treino por dia (só o que conta para a dose). */
export function minutosPorDia(sessoes: readonly SessaoResumo[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const s of sessoes) {
    if (!contaParaDose(s)) continue;
    const dia = diaLocal(new Date(s.created_at));
    out.set(dia, (out.get(dia) ?? 0) + (s.segundos_activos ?? 0) / 60);
  }
  return out;
}

/**
 * Dias seguidos com pelo menos um treino que conta, terminando hoje (ou
 * ontem, se hoje ainda não houve treino -- a sequência não se perde de manhã).
 */
export function sequenciaDeDias(sessoes: readonly SessaoResumo[], hoje: Date): number {
  const dias = new Set(
    sessoes.filter((s) => contaParaDose(s) && (s.segundos_activos ?? 0) > 0).map((s) => diaLocal(new Date(s.created_at))),
  );
  const cursor = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  if (!dias.has(diaLocal(cursor))) cursor.setDate(cursor.getDate() - 1);
  let n = 0;
  while (dias.has(diaLocal(cursor))) {
    n++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return n;
}

/** Os últimos `n` dias (mais antigo primeiro), em `AAAA-MM-DD`. */
export function ultimosDias(hoje: Date, n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - (n - 1 - i));
    return diaLocal(d);
  });
}

/** Último resultado de cada teste por olho (sessões mais recentes primeiro). */
export function ultimosResultados<T extends SessaoResumo>(sessoes: readonly T[]): Map<string, T> {
  const out = new Map<string, T>();
  const ordenadas = [...sessoes].sort((a, b) => b.created_at.localeCompare(a.created_at));
  for (const s of ordenadas) {
    if (!IDS_TESTES.includes(s.exercicio_id)) continue;
    const chave = `${s.exercicio_id}:${s.olho ?? "?"}`;
    if (!out.has(chave)) out.set(chave, s);
  }
  return out;
}

/** Dias cobertos pelo relatório semanal (ecrã do pai e link do médico). */
export const DIAS_RELATORIO = 7;

/** O que o relatório precisa de cada sessão -- sem ids nem dados da conta. */
export type SessaoParaRelatorio = SessaoResumo & { calibrado: boolean | null };
