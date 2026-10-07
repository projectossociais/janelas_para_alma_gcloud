import { cn } from "../cn";

/**
 * Indicador de carregamento. Decorativo (`aria-hidden`): quem o usa anuncia o
 * estado (ex.: `aria-busy` no botão). Gira só se a pessoa não pediu menos
 * movimento; com movimento reduzido fica parado, e o estado continua a ser
 * anunciado.
 */
export const Indicador = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden
    className={cn("size-5 motion-safe:animate-spin", className)}
  >
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);
