/**
 * Estereograma de pontos aleatórios em anáglifo (óculos vermelho-ciano).
 *
 * Imagem do olho esquerdo no canal vermelho, do direito nos canais verde e
 * azul. As duas imagens são o mesmo ruído, excepto numa forma central que
 * aparece deslocada em sentidos opostos em cada olho: com os dois olhos (e
 * os óculos), a forma salta do fundo; com um olho só, é ruído sem forma.
 *
 * Trabalha em píxeis de dispositivo (o canvas já vem multiplicado pelo
 * devicePixelRatio), para as disparidades pequenas não serem arredondadas
 * a zero.
 */

import type { Rng } from "./escada";

export type Forma = "circulo" | "quadrado" | "triangulo" | "estrela";
export const FORMAS: readonly Forma[] = ["circulo", "quadrado", "triangulo", "estrela"];

/** A forma contém o ponto (u, v)? Coordenadas normalizadas a [-1, 1]. */
export function dentroDaForma(forma: Forma, u: number, v: number): boolean {
  switch (forma) {
    case "circulo":
      return u * u + v * v <= 1;
    case "quadrado":
      return Math.abs(u) <= 0.85 && Math.abs(v) <= 0.85;
    case "triangulo": {
      // Bico para cima, base em baixo.
      if (v > 0.8 || v < -1) return false;
      const meiaLargura = ((v + 1) / 1.8) * 0.95;
      return Math.abs(u) <= meiaLargura;
    }
    case "estrela": {
      const r = Math.hypot(u, v);
      const a = Math.atan2(v, u) + Math.PI / 2;
      // Raio a oscilar entre 0,45 e 1 com 5 pontas.
      const limite = 0.45 + 0.55 * Math.abs(Math.cos((5 * a) / 2)) ** 1.5;
      return r <= limite;
    }
  }
}

export interface OpcoesEstereograma {
  largura: number;
  altura: number;
  /** Disparidade total, em píxeis de dispositivo (>= 1). */
  disparidade: number;
  forma: Forma;
  /** Lado de cada ponto aleatório, em píxeis de dispositivo. */
  tamanhoPonto: number;
  rng?: Rng;
}

/** Os dois canais (0 escuro / 1 claro), antes de se juntarem em cor. */
export function gerarPares(o: OpcoesEstereograma): { esquerda: Uint8Array; direita: Uint8Array } {
  const { largura: w, altura: h, forma, tamanhoPonto: p, rng = Math.random } = o;
  const d = Math.max(1, Math.round(o.disparidade));
  // Metade da disparidade para cada olho, em sentidos opostos (ímpar: 1 a mais à esquerda).
  const desvioEsq = Math.ceil(d / 2);
  const desvioDir = -Math.floor(d / 2);

  const colunas = Math.ceil(w / p) + 2;
  const linhas = Math.ceil(h / p);
  const ruidoFundo = new Uint8Array(colunas * linhas);
  const ruidoForma = new Uint8Array(colunas * linhas);
  for (let i = 0; i < ruidoFundo.length; i++) {
    ruidoFundo[i] = rng() < 0.5 ? 1 : 0;
    ruidoForma[i] = rng() < 0.5 ? 1 : 0;
  }
  const pontoEm = (ruido: Uint8Array, x: number, y: number) => {
    const c = Math.floor(x / p) + 1;
    const l = Math.min(linhas - 1, Math.max(0, Math.floor(y / p)));
    return ruido[l * colunas + Math.min(colunas - 1, Math.max(0, c))];
  };

  const raio = Math.min(w, h) * 0.32;
  const cx = w / 2;
  const cy = h / 2;
  const naForma = (x: number, y: number) => dentroDaForma(forma, (x - cx) / raio, (y - cy) / raio);

  const esquerda = new Uint8Array(w * h);
  const direita = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      // Em cada olho, o que está na forma deslocada vem do ruído da forma
      // (que se move com ela); o resto é o fundo parado. Mesmo ruído nos dois
      // olhos -> a única diferença entre eles é o deslocamento da forma.
      esquerda[i] = naForma(x - desvioEsq, y) ? pontoEm(ruidoForma, x - desvioEsq, y) : pontoEm(ruidoFundo, x, y);
      direita[i] = naForma(x - desvioDir, y) ? pontoEm(ruidoForma, x - desvioDir, y) : pontoEm(ruidoFundo, x, y);
    }
  }
  return { esquerda, direita };
}

/** RGBA do anáglifo: vermelho = olho esquerdo, verde+azul = olho direito. */
export function gerarEstereograma(o: OpcoesEstereograma): Uint8ClampedArray {
  const { esquerda, direita } = gerarPares(o);
  const px = new Uint8ClampedArray(o.largura * o.altura * 4);
  for (let i = 0; i < esquerda.length; i++) {
    const r = esquerda[i] * 255;
    const gb = direita[i] * 255;
    px[i * 4] = r;
    px[i * 4 + 1] = gb;
    px[i * 4 + 2] = gb;
    px[i * 4 + 3] = 255;
  }
  return px;
}
