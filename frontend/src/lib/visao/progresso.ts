/**
 * Contas de progresso a partir do histórico de sessões (versão 2): minutos
 * activos por dia, sequência de dias e o que conta para a dose do treino.
 *
 * Datas no fuso local do utilizador -- "hoje" é o dia do calendário dele.
 */

import { mesmoTipoDaUltima } from "./aglomeracao";

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

/**
 * Uma sessão é auto-avaliação? As do `convergence` só até 2026-10-20 (eram
 * "Vejo 1 / Vejo 2", em segundos); desde as Pontes de Fusão, a fusão é
 * verificada pelo próprio estímulo e o resultado vem em dioptrias prismáticas.
 */
export const eAutoAvaliacao = (exercicioId: string, unidade: string | null | undefined): boolean =>
  IDS_AUTOAVALIACAO.includes(exercicioId) && unidade !== "dioptrias_prismaticas";

/** `AAAA-MM-DD` no fuso local. */
export function diaLocal(data: Date): string {
  const a = data.getFullYear();
  const m = String(data.getMonth() + 1).padStart(2, "0");
  const d = String(data.getDate()).padStart(2, "0");
  return `${a}-${m}-${d}`;
}

/**
 * Uma sessão marcada como baixa atenção não conta para a dose. As horas de
 * tapa-olho (Caderneta do Tapa-olho, desde 2026-10-21) também não: são o
 * tratamento longe do ecrã e contam-se à parte (`lib/visao/caderneta.ts`).
 */
export const contaParaDose = (s: SessaoResumo): boolean =>
  IDS_TREINOS.includes(s.exercicio_id) && s.sinais?.baixa_atencao !== true && s.sinais?.modo !== "tapa_olho_horas";

/**
 * As sessões que entram no gráfico do progresso de um exercício: com limiar
 * medido, de um olho, e sem baixa atenção (não é medição fiável -- já ficava
 * fora da tendência; até 2026-10-08 o gráfico contradizia-a), e na unidade
 * da mais recente (o Kianda passou de logMAR a graus em 2026-10-21). Por ordem.
 */
export function sessoesDoGrafico<S extends SessaoResumo>(sessoes: readonly S[], exercicioId: string): S[] {
  // Acuidade com e sem barras (Olhos de Palanca) não se misturam no gráfico.
  const validas = mesmoTipoDaUltima(sessoes.filter((s) => s.exercicio_id === exercicioId))
    .filter(
      (s) =>
        s.exercicio_id === exercicioId &&
        s.limiar !== null &&
        (s.olho === "direito" || s.olho === "esquerdo") &&
        s.sinais?.baixa_atencao !== true,
    )
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const unidade = validas.length ? validas[validas.length - 1].unidade : null;
  return validas.filter((s) => s.unidade === unidade);
}

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

/** Dias cobertos pelo relatório semanal (ecrã do pai e link do médico). */
export const DIAS_RELATORIO = 7;

/**
 * O que o relatório precisa de cada sessão -- sem ids nem dados da conta. A
 * distância é opcional: o link do médico só a traz desde 2026-10-21.
 */
export type SessaoParaRelatorio = SessaoResumo & { calibrado: boolean | null; distancia_mm?: number | null };
