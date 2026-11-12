/** Palavras por minuto de uma leitura corrida em português (valor habitual nos blogues). */
export const PALAVRAS_POR_MINUTO = 200;

/** Minutos de leitura de um texto, arredondados para cima; nunca menos de 1. */
export function minutosDeLeitura(texto: string): number {
  const palavras = texto.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(palavras / PALAVRAS_POR_MINUTO));
}
