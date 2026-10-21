/**
 * Distância olhos-ecrã medida pelo ponto cego, sem câmara ("virtual chinrest",
 * Li, Joo, Yeatman e Reinecke, Scientific Reports 2020).
 *
 * Com um olho tapado, o outro fixa um quadrado; um ponto vermelho afasta-se
 * dele na horizontal, para o lado de fora (temporal) do olho que vê, e some
 * quando entra no ponto cego. A entrada do ponto cego fica a um ângulo quase
 * igual em toda a gente (13,5° no artigo; média medida 13,59°, dp 0,96°), por
 * isso a distância no ecrã entre o quadrado e o ponto nesse instante dá a
 * distância aos olhos: D = s / tan(13,5°). Erro médio no artigo: 3,25 cm
 * (dp 2,40 cm) entre 43 e 66 cm.
 *
 * Funções puras -- o desenho e o tempo vivem em `MedirDistancia.tsx`.
 */

import type { Olho } from "./resultados";

/** Ângulo da entrada do ponto cego, a partir do ponto de fixação. */
export const ANGULO_PONTO_CEGO_GRAUS = 13.5;

/**
 * Velocidade do ponto, em mm de ecrã por segundo. O artigo não a indica, e o
 * 13,5° já inclui o atraso de quem carrega na tecla. A borda do ponto cego
 * fica a ~12,5°; a 25 mm/s (~3°/s a 50 cm), um tempo de reacção de 0,3 s
 * soma ~1° e dá os 13,5° do artigo. Valor a confirmar na Fase 0 (bancada,
 * contra fita métrica) -- ver docs/ANALISE_EXERCICIOS.md.
 */
export const VELOCIDADE_PONTO_MM_S = 25;
/** O ponto parte a esta distância do quadrado (bem antes do ponto cego). */
export const INICIO_PONTO_MM = 20;
/** Lado do quadrado de fixação e diâmetro do ponto, em mm de ecrã. */
export const TAMANHO_ALVO_MM = 6;

/** Fora disto a medição não é plausível (toque cedo demais, olhar fugiu). */
export const DISTANCIA_MIN_MM = 200;
export const DISTANCIA_MAX_MM = 1500;

export const MEDICOES_MINIMAS = 3;
export const MEDICOES_MAXIMAS = 5;
/** Três medições concordam quando a amplitude é até 15% da mediana. */
export const DISPERSAO_MAX = 0.15;

const tanAngulo = Math.tan((ANGULO_PONTO_CEGO_GRAUS * Math.PI) / 180);

/** Distância aos olhos (mm) a partir do desvio no ecrã (mm) entre o quadrado e o ponto. */
export const distanciaDoDesvio = (desvioMm: number): number => desvioMm / tanAngulo;

/** Desvio no ecrã (mm) a que o ponto some, para uma distância aos olhos (mm). */
export const desvioDaDistancia = (distanciaMm: number): number => distanciaMm * tanAngulo;

/**
 * Maior distância que se consegue medir com o percurso que cabe no ecrã: o
 * ponto tem de chegar ao ponto cego antes da borda.
 */
export const distanciaMaximaMensuravel = (percursoMm: number): number => distanciaDoDesvio(Math.max(0, percursoMm));

/** Posição do ponto (mm a partir do quadrado) `segundos` depois de partir. */
export const desvioDoPonto = (segundos: number): number => INICIO_PONTO_MM + VELOCIDADE_PONTO_MM_S * Math.max(0, segundos);

/**
 * O ponto cego está do lado de fora do olho que vê: com o olho esquerdo, à
 * esquerda do ponto de fixação (-1); com o direito, à direita (+1).
 */
export const sentidoDoPonto = (olhoQueVe: Olho): -1 | 1 => (olhoQueVe === "esquerdo" ? -1 : 1);

/**
 * Mede-se com o olho que vê melhor: um olho amblíope pode não fixar bem o
 * quadrado, e a medição depende disso. Sem informação, o esquerdo (o olho
 * do artigo original).
 */
export const olhoParaMedir = (olhoMaisFraco: string | null | undefined): Olho =>
  olhoMaisFraco === "esquerdo" ? "direito" : "esquerdo";

export type ClassificacaoMedicao = "valida" | "curta" | "longa";

export const classificarMedicao = (distanciaMm: number): ClassificacaoMedicao =>
  distanciaMm < DISTANCIA_MIN_MM ? "curta" : distanciaMm > DISTANCIA_MAX_MM ? "longa" : "valida";

export type AvaliacaoMedicoes =
  | { estado: "continuar" }
  | { estado: "concluida"; distanciaMm: number }
  | { estado: "inconsistente" };

const mediana = (xs: readonly number[]): number => {
  const o = [...xs].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
};

/**
 * Junta as medições válidas: concluída quando há três que concordam (a
 * amplitude delas cabe em `DISPERSAO_MAX` da mediana). Usa as três mais
 * próximas entre si, para um toque fora de tempo não estragar a medição; o
 * resultado é a mediana delas, em mm inteiros. Sem três que concordem ao fim
 * de `MEDICOES_MAXIMAS`, é inconsistente -- repete-se do zero.
 */
export function avaliarMedicoes(medicoesMm: readonly number[]): AvaliacaoMedicoes {
  if (medicoesMm.length < MEDICOES_MINIMAS) return { estado: "continuar" };
  const ordenadas = [...medicoesMm].sort((a, b) => a - b);
  let melhor: number[] | null = null;
  let melhorDispersao = Infinity;
  for (let i = 0; i + MEDICOES_MINIMAS <= ordenadas.length; i++) {
    const janela = ordenadas.slice(i, i + MEDICOES_MINIMAS);
    const dispersao = (janela[janela.length - 1] - janela[0]) / mediana(janela);
    if (dispersao < melhorDispersao) {
      melhorDispersao = dispersao;
      melhor = janela;
    }
  }
  if (melhor && melhorDispersao <= DISPERSAO_MAX) return { estado: "concluida", distanciaMm: Math.round(mediana(melhor)) };
  return medicoesMm.length >= MEDICOES_MAXIMAS ? { estado: "inconsistente" } : { estado: "continuar" };
}
