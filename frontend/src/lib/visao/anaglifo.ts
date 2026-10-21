/**
 * Afinação dos óculos vermelho-ciano para um ecrã concreto.
 *
 * Nenhum par de óculos de cartão filtra na perfeição: o olho com o filtro
 * vermelho ainda vê um pouco do verde+azul, e o olho com o filtro ciano
 * ainda vê um pouco do vermelho. Essa fuga (diafonia) muda de ecrã para
 * ecrã e de óculos para óculos, e faz cada olho ver um "fantasma" da imagem
 * do outro -- exactamente o que um teste ou treino dicóptico não pode ter.
 *
 * Modelo (luminância linear, 0..1, normalizada pelo canal de cada filtro):
 *   olho esquerdo (filtro vermelho): vê R + a·G
 *   olho direito  (filtro ciano):    vê G + b·R
 * em que G é o valor comum dos canais verde e azul, `a` a fuga do ciano no
 * filtro vermelho e `b` a fuga do vermelho no filtro ciano.
 *
 * Medir `b` por anulação: sobre um fundo cinzento (R = G = P), um quadrado
 * com R = P + Δ e G = P - c·Δ. O olho direito vê no quadrado
 * (P - c·Δ) + b·(P + Δ) e no fundo P + b·P: são iguais quando c = b. A pessoa
 * move um cursor até o quadrado desaparecer nesse olho -- o valor do cursor
 * é a fuga. O mesmo, com os canais trocados, para `a`.
 *
 * Conhecidas as fugas, para cada olho ver a luminância pretendida (tE, tD):
 *   R = (tE - a·tD) / (1 - a·b),   G = (tD - b·tE) / (1 - a·b)
 * Por isso os estímulos afinados vivem à volta de um pedestal cinzento: é
 * preciso margem para baixo para subtrair a fuga.
 */

import { linearParaSrgb, srgbParaLinear } from "./contraste";
import type { Olho } from "./resultados";

export interface Afinacao {
  /** a: fuga do verde+azul através do filtro vermelho (olho esquerdo). */
  fugaNoVermelho: number;
  /** b: fuga do vermelho através do filtro ciano (olho direito). */
  fugaNoCiano: number;
}

export type Rgb = readonly [number, number, number];

/** Pedestal (luminância linear) à volta do qual se desenha tudo o que é afinado. */
export const PEDESTAL = 0.5;
/** Quanto o quadrado de anulação sobe acima do pedestal. */
export const DELTA_ANULACAO = 0.4;
/** Maior fuga que o cursor deixa escolher (óculos muito maus passam disto). */
export const FUGA_MAX = 0.5;
/** Amplitude máxima (luminância linear) dos estímulos afinados. */
export const AMPLITUDE_MAX = 0.45;

const limitar = (x: number, min = 0, max = 1) => Math.min(max, Math.max(min, x));

/** Luminância linear (0..1) -> valor de 8 bits do ecrã. */
export const linearPara8Bits = (l: number): number => Math.round(linearParaSrgb(limitar(l)) * 255);

/** Valor de 8 bits -> luminância linear (0..1). */
export const oitoBitsParaLinear = (v: number): number => srgbParaLinear(limitar(v, 0, 255) / 255);

const rgb = (r: number, g: number): Rgb => [linearPara8Bits(r), linearPara8Bits(g), linearPara8Bits(g)];

/**
 * Valores lineares dos canais (R, G=B) para cada olho ver a luminância
 * pretendida, descontada a fuga. Pode sair de [0, 1] -- quem chama escolhe
 * uma amplitude que caiba (ver `amplitudeMaxima`).
 */
export function canaisParaOlhos(tEsquerdo: number, tDireito: number, af: Afinacao): { r: number; g: number } {
  const a = af.fugaNoVermelho;
  const b = af.fugaNoCiano;
  const det = 1 - a * b;
  return { r: (tEsquerdo - a * tDireito) / det, g: (tDireito - b * tEsquerdo) / det };
}

/**
 * Cores do ecrã de anulação para o olho que está a ver: fundo cinzento e um
 * quadrado que esse olho deixa de ver quando `c` é igual à fuga do seu
 * filtro. Olho direito (filtro ciano): o quadrado sobe no vermelho e desce
 * no verde+azul. Olho esquerdo (filtro vermelho): o contrário.
 */
export function coresAnulacao(olhoQueVe: Olho, c: number): { fundo: Rgb; quadrado: Rgb } {
  const fundo = rgb(PEDESTAL, PEDESTAL);
  const sobe = PEDESTAL + DELTA_ANULACAO;
  const desce = PEDESTAL - limitar(c, 0, FUGA_MAX) * DELTA_ANULACAO;
  const quadrado = olhoQueVe === "direito" ? rgb(sobe, desce) : rgb(desce, sobe);
  return { fundo, quadrado };
}

/**
 * Maior amplitude à volta do pedestal com que os quatro casos (cada olho
 * claro ou escuro) cabem nos canais do ecrã depois de descontar a fuga.
 */
export function amplitudeMaxima(af: Afinacao): number {
  const cabe = (amp: number) =>
    [-1, 1].every((e) =>
      [-1, 1].every((d) => {
        const { r, g } = canaisParaOlhos(PEDESTAL + e * amp, PEDESTAL + d * amp, af);
        return r >= 0 && r <= 1 && g >= 0 && g <= 1;
      }),
    );
  for (let amp = AMPLITUDE_MAX; amp > 0; amp = Math.round((amp - 0.01) * 100) / 100) {
    if (cabe(amp)) return amp;
  }
  return 0;
}

/**
 * As quatro cores de um estereograma de pontos, indexadas por
 * `(esquerdo << 1) | direito` (1 = ponto claro nesse olho).
 *
 * Sem afinação: as cores puras de sempre (preto, ciano, vermelho, branco).
 * Com afinação: à volta do pedestal, com a fuga descontada -- cada olho deixa
 * de ver o fantasma do outro, à custa de algum contraste.
 */
export function coresEstereograma(af: Afinacao | null): readonly [Rgb, Rgb, Rgb, Rgb] {
  if (!af) {
    return [
      [0, 0, 0],
      [0, 255, 255],
      [255, 0, 0],
      [255, 255, 255],
    ];
  }
  const amp = amplitudeMaxima(af);
  const cor = (esq: 0 | 1, dir: 0 | 1): Rgb => {
    const { r, g } = canaisParaOlhos(PEDESTAL + (esq ? amp : -amp), PEDESTAL + (dir ? amp : -amp), af);
    return rgb(r, g);
  };
  return [cor(0, 0), cor(0, 1), cor(1, 0), cor(1, 1)];
}

// --- Guardar por aparelho -------------------------------------------------

/** É do ecrã e dos óculos, não da conta: fica só neste aparelho. */
const CHAVE_STORAGE = "jpa.visao.oculos";

export const fugaValida = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= FUGA_MAX;

export function lerAfinacao(): Afinacao | null {
  try {
    const bruto = window.localStorage.getItem(CHAVE_STORAGE);
    if (!bruto) return null;
    const dados = JSON.parse(bruto) as Partial<Afinacao>;
    if (!fugaValida(dados.fugaNoVermelho) || !fugaValida(dados.fugaNoCiano)) return null;
    return { fugaNoVermelho: dados.fugaNoVermelho, fugaNoCiano: dados.fugaNoCiano };
  } catch {
    return null;
  }
}

export function guardarAfinacao(af: Afinacao): void {
  try {
    window.localStorage.setItem(CHAVE_STORAGE, JSON.stringify(af));
  } catch {
    // armazenamento bloqueado: a afinação vale só para esta visita
  }
}

// --- Duas imagens (uma por olho) numa só ----------------------------------

/**
 * Tabela para juntar duas imagens em cinzentos -- uma desenhada para cada
 * olho -- numa só imagem vermelho-ciano. Índice `(cinzentoEsquerdo << 8) |
 * cinzentoDireito`; três bytes (R, G, B) por entrada.
 *
 * Sem afinação: o cinzento do olho esquerdo vai directo para o vermelho e o
 * do direito para o verde e o azul (contraste máximo, como o estereograma
 * sem afinação). Com afinação: cada cinzento passa a luminância à volta do
 * pedestal (branco = topo da amplitude, preto = fundo) e a fuga de cada
 * filtro é descontada (`canaisParaOlhos`).
 */
export function tabelaDosOlhos(af: Afinacao | null): Uint8ClampedArray {
  const tabela = new Uint8ClampedArray(256 * 256 * 3);
  const amp = af ? amplitudeMaxima(af) : 0;
  const luminancia = (cinzento: number) => PEDESTAL - amp + oitoBitsParaLinear(cinzento) * 2 * amp;
  for (let e = 0; e < 256; e++) {
    for (let d = 0; d < 256; d++) {
      const i = ((e << 8) | d) * 3;
      if (!af) {
        tabela[i] = e;
        tabela[i + 1] = d;
        tabela[i + 2] = d;
        continue;
      }
      const { r, g } = canaisParaOlhos(luminancia(e), luminancia(d), af);
      tabela[i] = linearPara8Bits(r);
      tabela[i + 1] = linearPara8Bits(g);
      tabela[i + 2] = tabela[i + 1];
    }
  }
  return tabela;
}

/**
 * Junta, píxel a píxel, a imagem do olho esquerdo e a do direito (RGBA, só o
 * canal vermelho conta -- são cinzentos) em `saida` (RGBA), com a tabela de
 * `tabelaDosOlhos`. As três têm o mesmo tamanho.
 */
export function juntarOlhos(
  esquerdo: Uint8ClampedArray,
  direito: Uint8ClampedArray,
  saida: Uint8ClampedArray,
  tabela: Uint8ClampedArray,
): void {
  for (let p = 0; p < saida.length; p += 4) {
    const i = ((esquerdo[p] << 8) | direito[p]) * 3;
    saida[p] = tabela[i];
    saida[p + 1] = tabela[i + 1];
    saida[p + 2] = tabela[i + 2];
    saida[p + 3] = 255;
  }
}
