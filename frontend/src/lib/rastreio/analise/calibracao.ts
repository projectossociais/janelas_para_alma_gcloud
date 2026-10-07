import { falha, sucesso, type Resultado } from "./tipos";

/**
 * Calibração da fase V1 (docs/MOTOR_ANALISE_RASTREIO.md §8), pelo método de
 * Pundlik et al. (2019): a pessoa fixa alvos a ângulos conhecidos; em cada olho,
 * a descentração do reflexo varia linearmente com o ângulo. O declive dá o
 * factor de Hirschberg dessa pessoa (Δ por mm) e a ordenada na origem a
 * descentração a olhar para a câmara (o kappa).
 */

/** Ângulo em graus → dioptrias prismáticas (100 × tangente). */
export const deltaDeGraus = (graus: number) => 100 * Math.tan((graus * Math.PI) / 180);

/**
 * Distância lateral (cm) a que se põe um alvo para um dado ângulo, com a pessoa
 * a `distanciaCm` da câmara e o alvo no mesmo plano da câmara.
 */
export const afastamentoDoAlvoCm = (graus: number, distanciaCm: number) =>
  distanciaCm * Math.tan((graus * Math.PI) / 180);

export interface PontoCalibracao {
  anguloGraus: number;
  /** Descentração do reflexo nesse olho (mm, qualquer convenção de sinal fixa). */
  descentracaoMm: number;
}

export interface Calibracao {
  /** Factor de Hirschberg medido: Δ por mm (valor absoluto do inverso do declive). */
  fatorDeltaPorMm: number;
  /** Descentração prevista a olhar para a câmara (mm). */
  descentracaoNaCameraMm: number;
  /** Qualidade do ajuste linear (0–1). */
  r2: number;
  pontos: number;
}

export type MotivoFalhaCalibracao = "poucos-angulos" | "sem-variacao";

/** Regressão linear da descentração (mm) contra o ângulo (Δ). Precisa de 3 ângulos diferentes. */
export function calibrar(pontos: readonly PontoCalibracao[]): Resultado<Calibracao, MotivoFalhaCalibracao> {
  const angulos = new Set(pontos.map((p) => p.anguloGraus));
  if (angulos.size < 3) return falha("poucos-angulos");
  const xs = pontos.map((p) => deltaDeGraus(p.anguloGraus));
  const ys = pontos.map((p) => p.descentracaoMm);
  const n = pontos.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxx = 0, sxy = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - mx;
    const dy = ys[i]! - my;
    sxx += dx * dx; sxy += dx * dy; syy += dy * dy;
  }
  const declive = sxy / sxx;
  if (!Number.isFinite(declive) || Math.abs(declive) < 1e-9) return falha("sem-variacao");
  return sucesso({
    fatorDeltaPorMm: 1 / Math.abs(declive),
    descentracaoNaCameraMm: my - declive * mx,
    r2: syy > 0 ? (sxy * sxy) / (sxx * syy) : 1,
    pontos: n,
  });
}

/** Critérios da fase V1, escritos antes das medições (docs/MOTOR_ANALISE_RASTREIO.md §8). */
export const CRITERIOS_V1 = {
  fatorMinimo: 19,
  fatorMaximo: 23,
  r2Minimo: 0.95,
  desvioMaximoSemEstrabismoDelta: 3,
} as const;

export const calibracaoPassaV1 = (c: Calibracao) =>
  c.fatorDeltaPorMm >= CRITERIOS_V1.fatorMinimo &&
  c.fatorDeltaPorMm <= CRITERIOS_V1.fatorMaximo &&
  c.r2 >= CRITERIOS_V1.r2Minimo;
