/**
 * Conversões entre sRGB e luminância linear, para as cores de um ecrã de 8
 * bits (usadas pelo anáglifo). O teste de contraste com anéis cinzentos saiu
 * em 2026-10-21 (deu lugar ao Fio de Missangas).
 */

/** sRGB (0..1) -> luminância linear (0..1). */
export const srgbParaLinear = (c: number): number =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;

/** Luminância linear (0..1) -> sRGB (0..1). */
export const linearParaSrgb = (l: number): number =>
  l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055;
