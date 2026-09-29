/**
 * Contraste de um anel escuro sobre fundo branco, num ecrã de 8 bits.
 *
 * Contraste de Weber com fundo branco (luminância linear 1):
 *   C = (Lfundo - Lanel) / Lfundo = 1 - Lanel
 * O ecrã recebe valores sRGB (0..255, não lineares), por isso converte-se a
 * luminância pretendida para sRGB e arredonda-se ao inteiro. Depois do
 * arredondamento o contraste real pode afastar-se do pretendido -- é sempre
 * o **real** que conta para o resultado, e os degraus que o ecrã não consegue
 * mostrar (ou que coincidem com o degrau anterior) são descartados.
 */

/** sRGB (0..1) -> luminância linear (0..1). */
export const srgbParaLinear = (c: number): number =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;

/** Luminância linear (0..1) -> sRGB (0..1). */
export const linearParaSrgb = (l: number): number =>
  l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055;

/** Degraus do teste, em fracção (100% ... 0,8%). */
export const DEGRAUS_TESTE_CONTRASTE = [1, 0.5, 0.25, 0.125, 0.063, 0.031, 0.016, 0.008];

/** Degraus do treino: passos de 0,1 unidades log, de 100% a ~0,8%. */
export const DEGRAUS_TREINO_CONTRASTE = Array.from({ length: 22 }, (_, i) => 10 ** (-i / 10));

/** Erro relativo máximo aceite entre o contraste pedido e o que o ecrã mostra. */
export const ERRO_RELATIVO_MAX = 0.25;

export interface DegrauContraste {
  /** Contraste pedido (fracção). */
  pedido: number;
  /** Contraste real depois de arredondar a 8 bits (fracção). */
  real: number;
  /** Valor de cinzento 0..255 do anel. */
  cinzento: number;
}

/** Cinzento (0..255) do anel para um contraste de Weber sobre branco. */
export const cinzentoParaContraste = (contraste: number): number =>
  Math.round(linearParaSrgb(Math.min(Math.max(1 - contraste, 0), 1)) * 255);

/** Contraste de Weber real de um cinzento sobre branco. */
export const contrasteDoCinzento = (cinzento: number): number => 1 - srgbParaLinear(cinzento / 255);

export function degrauContraste(contraste: number): DegrauContraste {
  const cinzento = cinzentoParaContraste(contraste);
  return { pedido: contraste, real: contrasteDoCinzento(cinzento), cinzento };
}

/**
 * Só os degraus que um ecrã de 8 bits consegue mostrar: cinzento diferente
 * do branco, perto do pedido, e diferente do degrau anterior.
 */
export function degrausMostraveis(pedidos: readonly number[]): DegrauContraste[] {
  const out: DegrauContraste[] = [];
  for (const p of pedidos) {
    const d = degrauContraste(p);
    if (d.cinzento >= 255) continue;
    if (Math.abs(d.real - p) / p > ERRO_RELATIVO_MAX) continue;
    if (out.length && out[out.length - 1].cinzento === d.cinzento) continue;
    out.push(d);
  }
  return out;
}

/** Sensibilidade ao contraste: -log10(contraste limiar). */
export const sensibilidade = (contrasteLimiar: number): number =>
  Math.round(-Math.log10(contrasteLimiar) * 100) / 100 + 0; // "+ 0" evita -0

/** Cor CSS de um cinzento. */
export const corCinzento = (cinzento: number): string => `rgb(${cinzento}, ${cinzento}, ${cinzento})`;
