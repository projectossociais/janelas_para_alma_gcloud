import type { ImagemCinza, Ponto } from "./tipos";

/** Luminância Rec. 709 de uma imagem RGBA (como `ImageData.data`). */
export function paraCinza(rgba: ArrayLike<number>, largura: number, altura: number): ImagemCinza {
  const dados = new Float32Array(largura * altura);
  for (let i = 0; i < dados.length; i++) {
    const j = i * 4;
    dados[i] = 0.2126 * (rgba[j] ?? 0) + 0.7152 * (rgba[j + 1] ?? 0) + 0.0722 * (rgba[j + 2] ?? 0);
  }
  return { largura, altura, dados };
}

export const imagemVazia = (largura: number, altura: number, valor = 0): ImagemCinza => ({
  largura,
  altura,
  dados: new Float32Array(largura * altura).fill(valor),
});

/** Valor de um píxel inteiro; fora da imagem, o píxel da borda mais próximo. */
export function valor(img: ImagemCinza, x: number, y: number): number {
  const xi = Math.min(img.largura - 1, Math.max(0, x));
  const yi = Math.min(img.altura - 1, Math.max(0, y));
  return img.dados[yi * img.largura + xi] ?? 0;
}

/** Valor num ponto qualquer, por interpolação bilinear. */
export function amostrar(img: ImagemCinza, x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const a = valor(img, x0, y0);
  const b = valor(img, x0 + 1, y0);
  const c = valor(img, x0, y0 + 1);
  const d = valor(img, x0 + 1, y0 + 1);
  return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
}

export interface Recorte {
  imagem: ImagemCinza;
  /** Posição do canto superior esquerdo do recorte na imagem original. */
  origem: Ponto;
}

/** Copia uma região quadrada à volta de um centro, limitada às bordas da imagem. */
export function recortar(img: ImagemCinza, centro: Ponto, meioLado: number): Recorte {
  const x0 = Math.max(0, Math.floor(centro.x - meioLado));
  const y0 = Math.max(0, Math.floor(centro.y - meioLado));
  const x1 = Math.min(img.largura, Math.ceil(centro.x + meioLado) + 1);
  const y1 = Math.min(img.altura, Math.ceil(centro.y + meioLado) + 1);
  const largura = Math.max(1, x1 - x0);
  const altura = Math.max(1, y1 - y0);
  const dados = new Float32Array(largura * altura);
  for (let y = 0; y < altura; y++) {
    const linha = (y0 + y) * img.largura + x0;
    dados.set(img.dados.subarray(linha, linha + largura), y * largura);
  }
  return { imagem: { largura, altura, dados }, origem: { x: x0, y: y0 } };
}

/** Percentil `p` (0–1) por posição na lista ordenada (cópia; os valores originais não mudam). */
export function percentil(valores: ArrayLike<number>, p: number): number {
  if (valores.length === 0) return Number.NaN;
  const ordenados = Float64Array.from(valores).sort();
  return ordenados[Math.min(ordenados.length - 1, Math.max(0, Math.round(p * (ordenados.length - 1))))] ?? Number.NaN;
}

/** Mediana (cópia ordenada; os valores originais não mudam). */
export function mediana(valores: ArrayLike<number>): number {
  if (valores.length === 0) return Number.NaN;
  const ordenados = Float64Array.from(valores).sort();
  const meio = ordenados.length >> 1;
  return ordenados.length % 2 ? (ordenados[meio] ?? 0) : ((ordenados[meio - 1] ?? 0) + (ordenados[meio] ?? 0)) / 2;
}
