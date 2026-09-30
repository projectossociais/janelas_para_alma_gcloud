/**
 * Cores oficiais da marca, tiradas dos vectores do manual "Identidade Visual
 * Um Olhar Alinhado" (XANUS PRO, 2025) -- não de uma imagem, por isso são os
 * valores exactos. Regras de uso em docs/MARCA.md.
 */
export const MARCA = {
  /** Fundo da capa e do logótipo negativo. Texto principal. */
  marinho: "#002151",
  /** Palavra "Janelas Para Alma" e moldura do símbolo. Cor de acção. */
  azul: "#0064A8",
  azulClaro: "#97CFFC",
  /** Lente do olho e assinatura. Nunca texto sobre fundo claro (2,6:1). */
  turquesa: "#15B4AA",
  verde: "#236A4D",
  dourado: "#DEC14C",
  /** Destaque de palavra sobre marinho (capa do manual). */
  lima: "#DCEDA1",
  creme: "#FCFFEE",
} as const;

/** Cores do símbolo, iguais nos dois fundos (só a moldura muda). */
export const SIMBOLO = {
  lente: "#00B4AA",
  iris: "#0064AB",
  pupila: "#000E16",
  brilho: "#FFFFFF",
  brilhoOpacidade: 0.87,
  moldura: { claro: "#0064A8", escuro: "#FFFFFF" },
  molduraOpacidade: 0.78,
} as const;
