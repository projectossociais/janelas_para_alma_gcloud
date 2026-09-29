/**
 * Evolução de um olho num exercício, em termos que um pai percebe ("lê 2
 * linhas mais pequenas do que há 3 semanas") -- Fase A de
 * docs/ANALISE_EXERCICIOS.md.
 *
 * Regras, para nunca prometer melhoria que é só ruído:
 * - compara a mediana das primeiras sessões (até 3) com a das mais recentes
 *   (até 3), sem sessões em comum; são precisas pelo menos 2, em dias
 *   diferentes;
 * - só há "melhorou"/"piorou" a partir de uma linha de acuidade (0,1 logMAR,
 *   a variabilidade típica de teste-reteste) ou de 0,15 log de contraste
 *   (um degrau de Pelli-Robson); abaixo disso é "estável";
 * - sessões de baixa atenção ficam de fora; se houver sessões calibradas
 *   com cartão, as não calibradas também (tamanhos só aproximados).
 */
import { diaLocal, type SessaoResumo } from "@/lib/visao/progresso";
import type { Olho } from "@/lib/visao/resultados";

export type UnidadeTendencia = "logmar" | "log_cs";

export type Tendencia =
  | { tipo: "poucos_dados" }
  | {
      tipo: "melhorou" | "piorou" | "estavel";
      unidade: UnidadeTendencia;
      /** Valor de referência (início) e actual (fim), na unidade. */
      inicio: number;
      actual: number;
      /** Linhas de acuidade (logMAR) ou degraus de contraste, sempre >= 0. */
      passos: number;
      /** Dias entre a primeira sessão usada e a última. */
      dias: number;
      /** Só com sessões sem cartão: resultado aproximado. */
      aproximado: boolean;
    };

const JANELA = 3;
/** Uma linha de acuidade. */
export const PASSO_LOGMAR = 0.1;
/** Um degrau de sensibilidade ao contraste (Pelli-Robson: tripletos de 0,15 log). */
export const PASSO_LOG_CS = 0.15;
const EPS = 1e-6;

const mediana = (xs: number[]): number => {
  const o = [...xs].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
};

const MS_POR_DIA = 24 * 60 * 60 * 1000;

export function tendencia<T extends SessaoResumo & { calibrado?: boolean | null }>(
  sessoes: readonly T[],
  exercicioId: string,
  olho: Olho,
): Tendencia {
  const doOlho = sessoes.filter(
    (s) =>
      s.exercicio_id === exercicioId &&
      s.olho === olho &&
      typeof s.limiar === "number" &&
      (s.unidade === "logmar" || s.unidade === "log_cs") &&
      s.sinais?.baixa_atencao !== true,
  );
  const calibradas = doOlho.filter((s) => s.calibrado === true);
  const usadas = (calibradas.length >= 2 ? calibradas : doOlho).sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  );
  const diasDistintos = new Set(usadas.map((s) => diaLocal(new Date(s.created_at))));
  if (usadas.length < 2 || diasDistintos.size < 2) return { tipo: "poucos_dados" };

  const n = Math.min(JANELA, Math.floor(usadas.length / 2));
  const primeiras = usadas.slice(0, n);
  const ultimas = usadas.slice(-n);
  const unidade = usadas[0].unidade as UnidadeTendencia;
  const inicio = mediana(primeiras.map((s) => s.limiar as number));
  const actual = mediana(ultimas.map((s) => s.limiar as number));
  // logMAR: mais baixo é melhor. log CS: mais alto é melhor.
  const ganho = unidade === "logmar" ? inicio - actual : actual - inicio;
  const passo = unidade === "logmar" ? PASSO_LOGMAR : PASSO_LOG_CS;
  const passos = Math.floor((Math.abs(ganho) + EPS) / passo);
  const dias = Math.round(
    (new Date(usadas[usadas.length - 1].created_at).getTime() - new Date(usadas[0].created_at).getTime()) /
      MS_POR_DIA,
  );
  return {
    tipo: passos === 0 ? "estavel" : ganho > 0 ? "melhorou" : "piorou",
    unidade,
    inicio,
    actual,
    passos,
    dias: Math.max(1, dias),
    aproximado: calibradas.length < 2,
  };
}
