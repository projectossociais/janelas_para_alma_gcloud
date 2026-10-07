/**
 * Tipos do motor de análise do rastreio (docs/MOTOR_ANALISE_RASTREIO.md).
 *
 * Coordenadas sempre em píxeis da fotografia original, com a origem no canto
 * superior esquerdo: `x` cresce para a direita e `y` para baixo.
 */

export interface Ponto {
  x: number;
  y: number;
}

export interface Circulo {
  centro: Ponto;
  raio: number;
}

/** Imagem em tons de cinzento (luminância de 0 a 255), linha a linha. */
export interface ImagemCinza {
  largura: number;
  altura: number;
  dados: Float32Array;
}

/** Resultado que pode falhar por um motivo conhecido, nunca por excepção. */
export type Resultado<T, Motivo extends string> = { ok: true; valor: T } | { ok: false; motivo: Motivo };

export const sucesso = <T>(valor: T) => ({ ok: true, valor }) as const;
export const falha = <M extends string>(motivo: M) => ({ ok: false, motivo }) as const;
