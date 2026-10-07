import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";
import { ALVO, ESCALA_TIPO, RAIO } from "./tokens";

/**
 * Junta classes e resolve conflitos do Tailwind, **conhecendo os nomes do
 * sistema de design**. O `cn` genérico (`@/lib/utils`) não os conhece: em
 * `text-corpo text-tinta` julgaria que ambos são cores e apagaria o tamanho
 * de letra sem aviso. Nos componentes de `src/design/` usa-se sempre este.
 */
const juntar = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: Object.keys(ESCALA_TIPO) }],
      rounded: [{ rounded: Object.keys(RAIO) }],
      shadow: [{ shadow: ["nivel-1", "nivel-2", "contorno-erro"] }],
      "min-h": [{ "min-h": Object.keys(ALVO).map((n) => `alvo-${n}`) }],
      "min-w": [{ "min-w": Object.keys(ALVO).map((n) => `alvo-${n}`) }],
    },
  },
});

export const cn = (...entradas: ClassValue[]) => juntar(clsx(entradas));
