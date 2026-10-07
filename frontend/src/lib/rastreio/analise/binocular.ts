import type { MedicaoOlho } from "./olho";
import { falha, sucesso, type Resultado } from "./tipos";

/**
 * Do par de olhos ao desvio, pelo método de Hirschberg fotográfico
 * (docs/MOTOR_ANALISE_RASTREIO.md §3 e §6).
 *
 * Em cada olho mede-se a **descentração** do reflexo: a distância do reflexo ao
 * centro da íris, em milímetros, com o sentido "para o nariz" positivo (e "para
 * cima" positivo). Com a criança a olhar para a luz:
 *
 *   olho que fixa:      descentração = κ
 *   olho desviado:      descentração = κ + desvio / FH
 *
 * em que κ é o ângulo kappa (o reflexo normal fica ligeiramente para o nariz) e
 * FH o factor de Hirschberg. A **diferença** entre os dois olhos dá o desvio e
 * anula κ, se for igual nos dois olhos.
 *
 * Limitação conhecida, que os testes documentam: se a criança olhar um pouco ao
 * lado da luz (ângulo θ, os dois olhos juntos), a descentração de um olho
 * diminui θ/FH e a do outro aumenta θ/FH, e a diferença ganha 2θ. Por isso o
 * alvo de fixação tem de estar junto à luz, tiram-se várias fotografias, e a
 * dispersão entre elas é um portão de qualidade (`sessao.ts`).
 */

/** Δ por milímetro de deslocação do reflexo (Brodie 1987: ~21 Δ/mm). */
export const FATOR_HIRSCHBERG_DELTA_POR_MM = 21;
/** Diâmetro horizontal da íris na população (MediaPipe Iris: 11,7 ± 0,5 mm). */
export const DIAMETRO_IRIS_MM = 11.7;
/** Descentração nasal típica do reflexo no olho que fixa (ângulo kappa positivo, ~0,5 mm). */
export const KAPPA_POPULACIONAL_MM = 0.5;
/** Os dois diâmetros de íris não podem diferir mais do que isto (cabeça rodada ou erro de medida). */
export const DIFERENCA_IRIS_MAXIMA = 0.12;
/** Abaixo disto a direcção (para dentro / para fora) não é fiável (EyeTurn Cloud, 2025). */
export const DESVIO_MINIMO_PARA_DIRECCAO_DELTA = 10;

export type MotivoFalhaBinocular = "iris-inconsistentes";

export interface Descentracao {
  /** Milímetros; positivo = reflexo para o lado do nariz. */
  nasal: number;
  /** Milímetros; positivo = reflexo acima do centro da íris. */
  superior: number;
}

export interface DesvioBinocular {
  /** Descentração nasal do olho direito menos a do esquerdo, em Δ (com sinal). */
  horizontalDelta: number;
  /** Descentração superior do olho direito menos a do esquerdo, em Δ (com sinal). */
  verticalDelta: number;
  mmPorPx: number;
  direito: Descentracao;
  esquerdo: Descentracao;
}

/**
 * @param espelhada `true` se a imagem estiver espelhada (pré-visualização da
 *   câmara frontal). Numa fotografia normal, o olho direito da pessoa aparece
 *   à esquerda da imagem.
 */
export function desvioBinocular(
  a: MedicaoOlho,
  b: MedicaoOlho,
  opcoes: { espelhada?: boolean } = {},
): Resultado<DesvioBinocular, MotivoFalhaBinocular> {
  const [aEsquerdaImagem, aDireitaImagem] = a.iris.centro.x <= b.iris.centro.x ? [a, b] : [b, a];
  const [direito, esquerdo] = opcoes.espelhada ? [aDireitaImagem, aEsquerdaImagem] : [aEsquerdaImagem, aDireitaImagem];

  const dDireito = 2 * direito.iris.raio;
  const dEsquerdo = 2 * esquerdo.iris.raio;
  const dMedio = (dDireito + dEsquerdo) / 2;
  if (Math.abs(dDireito - dEsquerdo) / dMedio > DIFERENCA_IRIS_MAXIMA) return falha("iris-inconsistentes");
  const mmPorPx = DIAMETRO_IRIS_MM / dMedio;

  const descentracao = (olho: MedicaoOlho, outro: MedicaoOlho): Descentracao => {
    // O nariz fica do lado do outro olho, seja qual for o espelhamento.
    const sentidoNasal = Math.sign(outro.iris.centro.x - olho.iris.centro.x) || 1;
    return {
      nasal: sentidoNasal * (olho.reflexo.x - olho.iris.centro.x) * mmPorPx,
      superior: -(olho.reflexo.y - olho.iris.centro.y) * mmPorPx,
    };
  };
  const dDir = descentracao(direito, esquerdo);
  const dEsq = descentracao(esquerdo, direito);

  return sucesso({
    horizontalDelta: (dDir.nasal - dEsq.nasal) * FATOR_HIRSCHBERG_DELTA_POR_MM,
    verticalDelta: (dDir.superior - dEsq.superior) * FATOR_HIRSCHBERG_DELTA_POR_MM,
    mmPorPx,
    direito: dDir,
    esquerdo: dEsq,
  });
}

export type Direccao = "exo" | "eso";

/**
 * Para fora (exo) ou para dentro (eso), só a partir de 10 Δ. Assume que o olho
 * que fixa é o que tem a descentração mais próxima do kappa típico; no olho
 * desviado, reflexo mais para o nariz do que esse = olho virado para fora.
 */
export function direccaoHorizontal(d: DesvioBinocular): Direccao | null {
  if (Math.abs(d.horizontalDelta) < DESVIO_MINIMO_PARA_DIRECCAO_DELTA) return null;
  const distanciaKappa = (x: Descentracao) => Math.abs(x.nasal - KAPPA_POPULACIONAL_MM);
  const [fixa, desviado] =
    distanciaKappa(d.direito) <= distanciaKappa(d.esquerdo) ? [d.direito, d.esquerdo] : [d.esquerdo, d.direito];
  return desviado.nasal > fixa.nasal ? "exo" : "eso";
}
