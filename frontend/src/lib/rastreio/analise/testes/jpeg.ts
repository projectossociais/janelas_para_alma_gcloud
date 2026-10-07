import type { ImagemCinza } from "../tipos";

/**
 * Simulação da compressão JPEG em tons de cinzento, para testar o motor com os
 * artefactos que os telemóveis introduzem ao gravar fotografias.
 *
 * Faz o que o JPEG faz à luminância: blocos de 8×8, transformada DCT, divisão
 * pela tabela de quantização normalizada (norma JPEG, anexo K, escalada pela
 * qualidade como na libjpeg) e arredondamento, depois a transformada inversa.
 * Não simula a codificação entrópica (sem perdas) nem a crominância.
 */

const TABELA_LUMINANCIA = [
  16, 11, 10, 16, 24, 40, 51, 61, 12, 12, 14, 19, 26, 58, 60, 55, 14, 13, 16, 24, 40, 57, 69, 56, 14, 17, 22, 29, 51, 87, 80, 62,
  18, 22, 37, 56, 68, 109, 103, 77, 24, 35, 55, 64, 81, 104, 113, 92, 49, 64, 78, 87, 103, 121, 120, 101, 72, 92, 95, 98, 112, 100,
  103, 99,
];

/** Tabela de quantização para uma qualidade de 1 a 100 (regra da libjpeg). */
export function tabelaQuantizacao(qualidade: number): number[] {
  const q = Math.min(100, Math.max(1, qualidade));
  const escala = q < 50 ? 5000 / q : 200 - 2 * q;
  return TABELA_LUMINANCIA.map((v) => Math.min(255, Math.max(1, Math.floor((v * escala + 50) / 100))));
}

const COS = Array.from({ length: 8 }, (_, x) => Array.from({ length: 8 }, (_, u) => Math.cos(((2 * x + 1) * u * Math.PI) / 16)));
const C = (u: number) => (u === 0 ? Math.SQRT1_2 : 1);

export function simularJpeg(img: ImagemCinza, qualidade: number): ImagemCinza {
  const { largura, altura } = img;
  const tabela = tabelaQuantizacao(qualidade);
  const out = new Float32Array(largura * altura);
  const bloco = new Float64Array(64);
  const coef = new Float64Array(64);
  const px = (x: number, y: number) =>
    Math.round(img.dados[Math.min(altura - 1, y) * largura + Math.min(largura - 1, x)] ?? 0) - 128;

  for (let by = 0; by < altura; by += 8)
    for (let bx = 0; bx < largura; bx += 8) {
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bloco[y * 8 + x] = px(bx + x, by + y);
      // DCT-II 2D, quantização e arredondamento.
      for (let v = 0; v < 8; v++)
        for (let u = 0; u < 8; u++) {
          let s = 0;
          for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) s += bloco[y * 8 + x]! * COS[x]![u]! * COS[y]![v]!;
          const valorDct = 0.25 * C(u) * C(v) * s;
          const t = tabela[v * 8 + u]!;
          coef[v * 8 + u] = Math.round(valorDct / t) * t;
        }
      // Transformada inversa.
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++) {
          let s = 0;
          for (let v = 0; v < 8; v++) for (let u = 0; u < 8; u++) s += C(u) * C(v) * coef[v * 8 + u]! * COS[x]![u]! * COS[y]![v]!;
          const X = bx + x;
          const Y = by + y;
          if (X < largura && Y < altura) out[Y * largura + X] = Math.min(255, Math.max(0, Math.round(0.25 * s + 128)));
        }
    }
  return { largura, altura, dados: out };
}
