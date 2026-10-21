/**
 * Olhos de Palanca: acuidade com aglomeração (crowding).
 *
 * Na ambliopia, sobretudo a estrábica, o olho fraco lê muito pior um símbolo
 * rodeado de outros contornos do que o mesmo símbolo isolado. Por isso os
 * testes de acuidade usados na ambliopia em crianças rodeiam o optótipo de
 * barras: o resultado fica mais sensível ao olho preguiçoso e à sua evolução.
 *
 * Aqui: quatro barras de Flom à volta do anel de Landolt, com a espessura do
 * traço (1 abertura), o comprimento do anel (5 aberturas) e a 1 traço de
 * distância -- a separação em que a interacção de contornos é mais forte
 * (Flom, Weymouth e Kahneman, 1963). Unidades: aberturas do anel.
 */

export const LADO_ANEL = 5;
export const ESPESSURA_BARRA = 1;
export const COMPRIMENTO_BARRA = LADO_ANEL;
/** Distância entre o anel e cada barra (bordo a bordo). */
export const ESPACO_BARRA = 1;
/** Lado do conjunto anel + barras: 5 + 2 x (1 + 1) = 9 aberturas. */
export const LADO_COM_BARRAS = LADO_ANEL + 2 * (ESPACO_BARRA + ESPESSURA_BARRA);

/**
 * Até este lado (px CSS) o conjunto com barras cabe no palco de um telemóvel.
 * Acima disso -- só nos tamanhos maiores, muito longe do limiar, onde a
 * aglomeração não muda a leitura -- o anel aparece sem barras.
 */
export const LADO_MAX_COM_BARRAS_PX = 320;

export interface Barra {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

/** As quatro barras, em aberturas, centradas no anel (cima, baixo, esquerda, direita). */
export function barrasDeFlom(): Barra[] {
  const dentro = LADO_ANEL / 2 + ESPACO_BARRA; // 3,5
  const meio = COMPRIMENTO_BARRA / 2;
  return [
    { x: -meio, y: -(dentro + ESPESSURA_BARRA), largura: COMPRIMENTO_BARRA, altura: ESPESSURA_BARRA },
    { x: -meio, y: dentro, largura: COMPRIMENTO_BARRA, altura: ESPESSURA_BARRA },
    { x: -(dentro + ESPESSURA_BARRA), y: -meio, largura: ESPESSURA_BARRA, altura: COMPRIMENTO_BARRA },
    { x: dentro, y: -meio, largura: ESPESSURA_BARRA, altura: COMPRIMENTO_BARRA },
  ];
}

/** Este tamanho de anel (abertura em px CSS) leva barras, ou o conjunto não cabe? */
export const levaBarras = (aberturaPx: number): boolean => aberturaPx * LADO_COM_BARRAS <= LADO_MAX_COM_BARRAS_PX;

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

/**
 * Só as sessões do mesmo tipo da mais recente (com barras ou sem): com
 * barras, a acuidade é pior por natureza, e misturar os dois tipos numa
 * tendência inventava uma piora no dia da mudança. Sem sessões, vazio.
 */
export function mesmoTipoDaUltima<S extends ComSinais>(sessoes: readonly S[]): S[] {
  if (!sessoes.length) return [];
  const ultima = sessoes.reduce((a, b) => (b.created_at > a.created_at ? b : a));
  const tipo = eAglomerada(ultima);
  return sessoes.filter((s) => eAglomerada(s) === tipo);
}
