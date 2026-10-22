/**
 * Olhos de Palanca: acuidade com aglomeração (crowding).
 *
 * Na ambliopia, sobretudo a estrábica, o olho fraco lê muito pior um símbolo
 * rodeado de outros contornos do que o mesmo símbolo isolado. Por isso os
 * testes de acuidade usados na ambliopia em crianças rodeiam o optótipo de
 * barras: o resultado fica mais sensível ao olho preguiçoso e à sua evolução.
 *
 * O anel com barras de Flom foi substituído em 2026-10-21 pela mãozinha "E"
 * a 3 metros (`palancaLonge.ts`); ficam aqui só a distinção entre tipos de
 * sessão (as antigas continuam no histórico) e a diferença entre olhos.
 */

/**
 * Diferença entre os olhos em linhas da tabela (0,1 logMAR por linha) -- a
 * medida principal da ambliopia. `null` se faltar um dos olhos.
 */
export const diferencaEmLinhas = (direito: number | null, esquerdo: number | null): number | null =>
  direito === null || esquerdo === null ? null : Math.round(Math.abs(direito - esquerdo) * 10 + 1e-9);

interface ComSinais {
  created_at: string;
  sinais?: Record<string, unknown> | null;
}

/** A sessão foi feita com barras (Olhos de Palanca, desde 2026-10-21)? */
export const eAglomerada = (s: ComSinais): boolean => s.sinais?.aglomeracao === true;

/** A sessão foi feita ao longe, com a mãozinha (Olhos de Palanca ao longe, desde 2026-10-21)? */
export const eAoLonge = (s: ComSinais): boolean => s.sinais?.ao_longe === true;

export type TipoAcuidade = "longe" | "barras" | "isolado";

/** Ao longe (3 m, mãozinha), de perto com barras, ou de perto com o anel isolado. */
export const tipoDeAcuidade = (s: ComSinais): TipoAcuidade => (eAoLonge(s) ? "longe" : eAglomerada(s) ? "barras" : "isolado");

/**
 * Só as sessões do mesmo tipo da mais recente: ao longe, com barras ou com o
 * anel isolado. Cada tipo dá valores diferentes por natureza, e misturá-los
 * numa tendência inventava uma piora (ou melhoria) no dia da mudança. Sem
 * sessões, vazio.
 */
export function mesmoTipoDaUltima<S extends ComSinais>(sessoes: readonly S[]): S[] {
  if (!sessoes.length) return [];
  const ultima = sessoes.reduce((a, b) => (b.created_at > a.created_at ? b : a));
  const tipo = tipoDeAcuidade(ultima);
  return sessoes.filter((s) => tipoDeAcuidade(s) === tipo);
}
