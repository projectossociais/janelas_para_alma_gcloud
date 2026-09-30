import type { ElementType, HTMLAttributes } from "react";
import { cn } from "../cn";

/**
 * Margens laterais e larguras nomeadas, iguais em todos os arquétipos
 * (docs/LAYOUTS.md §3): 16 px no telemóvel, 24 px no tablet, 32 px no computador.
 */
const LARGURA = {
  leitura: "max-w-xl", // 36 rem: tarefas, formulários
  texto: "max-w-2xl", // 42 rem: prosa
  conteudo: "max-w-6xl", // 72 rem: páginas do site
  largo: "max-w-7xl", // 80 rem: app, consola
} as const;

export interface ContentorProps extends HTMLAttributes<HTMLElement> {
  largura?: keyof typeof LARGURA;
  como?: ElementType;
}

export const Contentor = ({ largura = "conteudo", como: Elemento = "div", className, ...props }: ContentorProps) => (
  <Elemento className={cn("mx-auto w-full px-4 sm:px-6 lg:px-8", LARGURA[largura], className)} {...props} />
);

/** Primeiro elemento focável de cada página: salta a navegação (WCAG 2.4.1). */
export const SaltarConteudo = ({ rotulo, alvo = "conteudo" }: { rotulo: string; alvo?: string }) => (
  <a
    href={`#${alvo}`}
    className={cn(
      "sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50",
      "focus:rounded-controlo focus:bg-accao focus:px-5 focus:py-3 focus:text-corpo focus:font-medium focus:text-sobre-accao",
      "focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-foco",
    )}
  >
    {rotulo}
  </a>
);
