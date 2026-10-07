import { desvioBinocular, type DesvioBinocular, type MotivoFalhaBinocular } from "./binocular";
import { mediana } from "./imagem";
import { medirOlho, type MotivoFalhaOlho } from "./olho";
import { falha, sucesso, type Circulo, type ImagemCinza, type Resultado } from "./tipos";

/**
 * Uma sessão de rastreio: várias fotografias seguidas, cada uma medida à parte,
 * combinadas pela mediana. A dispersão entre fotografias é um portão de
 * qualidade: se variam muito, a criança não estava a olhar para a luz, ou
 * pestanejou, e não se dá um número.
 */

export const FOTOGRAFIAS_VALIDAS_MINIMAS = 2;
/**
 * Dispersão máxima aceite entre fotografias (Δ). **Provisório:** o valor
 * definitivo fixa-se com medições reais na fase V2 (docs/MOTOR_ANALISE_RASTREIO.md §8).
 */
export const DISPERSAO_MAXIMA_DELTA = 3;

export type MotivoFalhaFotografia = MotivoFalhaOlho | MotivoFalhaBinocular;
export type ResultadoFotografia = Resultado<DesvioBinocular, MotivoFalhaFotografia>;

/** Mede uma fotografia, dadas as posições aproximadas das duas íris. */
export function analisarFotografia(
  img: ImagemCinza,
  irisAproximadas: readonly [Circulo, Circulo],
  opcoes: { espelhada?: boolean } = {},
): ResultadoFotografia {
  const a = medirOlho(img, irisAproximadas[0]);
  if (a.ok === false) return falha(a.motivo);
  const b = medirOlho(img, irisAproximadas[1]);
  if (b.ok === false) return falha(b.motivo);
  return desvioBinocular(a.valor, b.valor, opcoes);
}

export type MotivoFalhaSessao = "poucas-fotografias-validas" | "medicoes-inconsistentes";

export interface ResultadoSessao {
  horizontalDelta: number;
  verticalDelta: number;
  /** Maior afastamento de uma fotografia à mediana (Δ, horizontal ou vertical). */
  dispersaoDelta: number;
  fotografiasValidas: number;
  fotografiasTotal: number;
  /** A fotografia válida mais próxima da mediana (para as descentrações e a escala). */
  representativa: DesvioBinocular;
}

export interface FalhaSessao {
  motivo: MotivoFalhaSessao;
  /** Quantas fotografias falharam por cada motivo, para orientar a repetição. */
  falhas: Partial<Record<MotivoFalhaFotografia, number>>;
  fotografiasTotal: number;
}

export function agregarSessao(
  resultados: readonly ResultadoFotografia[],
): Resultado<ResultadoSessao, MotivoFalhaSessao> & { detalhe?: FalhaSessao } {
  const validas: DesvioBinocular[] = [];
  const falhas: Partial<Record<MotivoFalhaFotografia, number>> = {};
  for (const r of resultados) {
    if (r.ok === false) falhas[r.motivo] = (falhas[r.motivo] ?? 0) + 1;
    else validas.push(r.valor);
  }
  const detalhe = (motivo: MotivoFalhaSessao): FalhaSessao => ({ motivo, falhas, fotografiasTotal: resultados.length });
  if (validas.length < FOTOGRAFIAS_VALIDAS_MINIMAS) {
    return { ...falha("poucas-fotografias-validas"), detalhe: detalhe("poucas-fotografias-validas") };
  }

  const h = mediana(validas.map((v) => v.horizontalDelta));
  const v = mediana(validas.map((x) => x.verticalDelta));
  const dispersao = Math.max(...validas.map((x) => Math.max(Math.abs(x.horizontalDelta - h), Math.abs(x.verticalDelta - v))));
  if (dispersao > DISPERSAO_MAXIMA_DELTA) {
    return { ...falha("medicoes-inconsistentes"), detalhe: detalhe("medicoes-inconsistentes") };
  }
  const representativa = validas.reduce((melhor, x) =>
    Math.hypot(x.horizontalDelta - h, x.verticalDelta - v) < Math.hypot(melhor.horizontalDelta - h, melhor.verticalDelta - v)
      ? x
      : melhor,
  );
  return sucesso({
    horizontalDelta: h,
    verticalDelta: v,
    dispersaoDelta: dispersao,
    fotografiasValidas: validas.length,
    fotografiasTotal: resultados.length,
    representativa,
  });
}
