/**
 * Interpretação de resultados -- só sinais para encaminhar a consulta, nunca
 * um diagnóstico. As frases mostradas ao utilizador vivem no i18n; aqui só
 * se decide *se* um sinal aparece.
 */

export type Olho = "direito" | "esquerdo";
export type OlhoSessao = Olho | "ambos";
export const OLHOS: readonly Olho[] = ["direito", "esquerdo"];

/** 6/9 em logMAR (log10(9/6) = 0,176). Pior do que isto -> sinal. */
export const LOGMAR_6_9 = Math.log10(9 / 6);
/** Diferença entre olhos a partir da qual há sinal (2 linhas). */
export const DIFERENCA_OLHOS_LOGMAR = 0.2;
const EPS = 1e-6;

export interface SinaisAcuidade {
  /** Olhos piores do que 6/9 (ou sem nível nenhum lido). */
  abaixoDe6_9: Olho[];
  /** Diferença de 2 linhas ou mais entre os olhos. */
  diferencaEntreOlhos: boolean;
}

/**
 * `null` num olho = não leu nem o nível maior -- também é sinal. `undefined`
 * = olho não testado (não entra nas contas).
 */
export function sinaisAcuidade(res: Partial<Record<Olho, number | null>>): SinaisAcuidade {
  const abaixoDe6_9 = OLHOS.filter((o) => {
    const v = res[o];
    return v === null || (v !== undefined && v > LOGMAR_6_9 + EPS);
  });
  const d = res.direito;
  const e = res.esquerdo;
  const diferencaEntreOlhos =
    typeof d === "number" && typeof e === "number" && Math.abs(d - e) >= DIFERENCA_OLHOS_LOGMAR - EPS;
  return { abaixoDe6_9, diferencaEntreOlhos };
}

/**
 * Olho com o pior resultado no Teste de Acuidade, para sugerir (nunca decidir
 * sozinho) qual treinar a quem respondeu "não sei". `null` num olho = não leu
 * nem o maior tamanho, que conta como o pior resultado possível. Devolve
 * `null` quando falta um dos olhos ou quando os dois ficaram no mesmo nível
 * -- aí o teste não identifica o olho e só a consulta o pode fazer.
 */
export function olhoMaisFracoPelaAcuidade(res: Partial<Record<Olho, number | null>>): Olho | null {
  const d = res.direito;
  const e = res.esquerdo;
  if (d === undefined || e === undefined) return null;
  if (d === null && e === null) return null;
  if (d === null) return "direito";
  if (e === null) return "esquerdo";
  if (Math.abs(d - e) < 0.1 - EPS) return null;
  return d > e ? "direito" : "esquerdo";
}

/**
 * Diferença de sensibilidade ao contraste entre olhos que merece atenção
 * (0,3 log = o dobro do contraste). Não há norma clínica aqui: só comparar
 * os olhos entre si e a evolução no tempo.
 */
export const DIFERENCA_OLHOS_LOG_CS = 0.3;

export function diferencaContraste(res: Partial<Record<Olho, number>>): boolean {
  const d = res.direito;
  const e = res.esquerdo;
  return typeof d === "number" && typeof e === "number" && Math.abs(d - e) >= DIFERENCA_OLHOS_LOG_CS - EPS;
}

/** Disparidades do teste de estereopsia, em segundos de arco (fácil -> difícil). */
export const DISPARIDADES_ARCSEG = [800, 400, 200, 140, 100, 70, 50, 40];
