import type { HTMLAttributes } from "react";
import { cn } from "../cn";

/**
 * Título de secção das páginas do site: 32 px no telemóvel, 48 px a partir do
 * computador. Um só sítio para esta decisão, para todas as páginas terem o
 * mesmo ritmo (48 px num ecrã de 390 px ocupa três linhas para quatro palavras).
 */
export const TituloSeccao = ({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
  <h2 className={cn("text-titulo-m text-tinta lg:text-titulo-g", className)} {...props} />
);
