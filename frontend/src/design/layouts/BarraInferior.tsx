import type { ReactNode } from "react";
import { AnimatePresence, m } from "motion/react";
import { cn } from "../cn";
import { MOLA } from "../movimento";

/**
 * Barra fixa em baixo, só no telemóvel, para a acção principal ficar na zona
 * do polegar (docs/LAYOUTS.md: Site, depois de a abertura sair do ecrã;
 * Tarefa, sempre). Respeita a zona segura do iPhone (safe-area).
 *
 * Quem usa reserva espaço no fim da página (`pb-24` no telemóvel), para a
 * barra nunca tapar o último conteúdo nem o elemento com foco (WCAG 2.4.11).
 */
export const BarraInferior = ({
  visivel = true,
  children,
  className,
}: {
  visivel?: boolean;
  children: ReactNode;
  className?: string;
}) => (
  <AnimatePresence initial={false}>
    {visivel && (
      <m.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={MOLA.tarefa}
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 border-t border-linha bg-superficie/95 px-4 pb-seguro-inferior pt-3 backdrop-blur sm:px-6 lg:hidden",
          className,
        )}
      >
        {children}
      </m.div>
    )}
  </AnimatePresence>
);
