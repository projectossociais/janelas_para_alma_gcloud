/**
 * Geometria dos optótipos: ângulo visual <-> milímetros <-> píxeis.
 *
 * Tudo em píxeis CSS (`pxPorMm` vem da calibração com o cartão de banco). O
 * limite do que o ecrã consegue desenhar mede-se em píxeis de dispositivo
 * (`px CSS * devicePixelRatio`): abaixo de ~1,4 px físicos a abertura do anel
 * deixa de ser desenhada com fidelidade e o nível é descartado.
 */

/** Braço esticado -- distância por omissão dos testes. */
export const DISTANCIA_OMISSAO_MM = 600;
/** Alternativa para ecrãs em que os níveis mais pequenos não cabem. */
export const DISTANCIA_LONGE_MM = 1000;
/** Mínimo de píxeis de dispositivo para uma abertura ainda ser fiável. */
export const MIN_PX_DISPOSITIVO = 1.4;

const ARCMIN_POR_RAD = 10800 / Math.PI;
const ARCSEG_POR_RAD = 648000 / Math.PI;

/** Tamanho linear (mm) de um ângulo em minutos de arco, à distância dada. */
export const arcminParaMm = (arcmin: number, distanciaMm: number): number =>
  distanciaMm * Math.tan(arcmin / ARCMIN_POR_RAD);

/** Tamanho em píxeis CSS de um ângulo em minutos de arco. */
export const arcminParaPx = (arcmin: number, distanciaMm: number, pxPorMm: number): number =>
  arcminParaMm(arcmin, distanciaMm) * pxPorMm;

/** Tamanho em píxeis CSS de um ângulo em segundos de arco (disparidade). */
export const arcsegParaPx = (arcseg: number, distanciaMm: number, pxPorMm: number): number =>
  distanciaMm * Math.tan(arcseg / ARCSEG_POR_RAD) * pxPorMm;

/** logMAR -> tamanho da abertura (MAR) em minutos de arco. */
export const logmarParaArcmin = (logmar: number): number => 10 ** logmar;

/** Abertura do anel de Landolt, em píxeis CSS, para um nível logMAR. */
export const aberturaPx = (logmar: number, distanciaMm: number, pxPorMm: number): number =>
  arcminParaPx(logmarParaArcmin(logmar), distanciaMm, pxPorMm);

/** Um tamanho em píxeis CSS ainda é desenhável com fidelidade neste ecrã? */
export const desenhavel = (px: number, devicePixelRatio: number): boolean =>
  px * devicePixelRatio >= MIN_PX_DISPOSITIVO;

/** Arredonda a 2 casas -- evita 0.30000000000000004 nos níveis. */
const r2 = (x: number) => Math.round(x * 100) / 100;

/**
 * Níveis logMAR do maior (mais fácil) para o mais pequeno (mais difícil),
 * de `de` até `ate` inclusive, em passos de `passo`.
 */
export const niveisLogmar = (de: number, ate: number, passo: number): number[] => {
  const n = Math.round((de - ate) / passo);
  return Array.from({ length: n + 1 }, (_, i) => r2(de - i * passo));
};

/** Níveis do teste de acuidade: 1,0 a -0,1 em passos de 0,1. */
export const NIVEIS_TESTE_ACUIDADE = niveisLogmar(1.0, -0.1, 0.1);
/** Níveis dos treinos de acuidade: mesma gama, passos de 0,05. */
export const NIVEIS_TREINO_ACUIDADE = niveisLogmar(1.0, -0.1, 0.05);

/** Só os níveis cuja abertura este ecrã, a esta distância, consegue desenhar. */
export const niveisDesenhaveis = (
  niveis: readonly number[],
  distanciaMm: number,
  pxPorMm: number,
  devicePixelRatio: number,
): number[] => niveis.filter((l) => desenhavel(aberturaPx(l, distanciaMm, pxPorMm), devicePixelRatio));

/** Acuidade decimal (1,0 = "10/10"). */
export const logmarParaDecimal = (logmar: number): number => r2(10 ** -logmar);

/** Denominador da fracção 6/x, arredondado a 0,5 (ex.: 6/9, 6/7,5). */
export const logmarParaDenominador6 = (logmar: number): number => Math.round(6 * 10 ** logmar * 2) / 2;

/** Formata uma fracção 6/x com vírgula decimal portuguesa quando preciso. */
export const fraccao6 = (logmar: number, separadorDecimal = ","): string => {
  const d = logmarParaDenominador6(logmar);
  return `6/${Number.isInteger(d) ? d : d.toFixed(1).replace(".", separadorDecimal)}`;
};
