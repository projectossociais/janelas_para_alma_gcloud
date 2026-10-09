import { cn } from "../cn";

/** Um destino da navegação da Consola (ligação ou botão), com o actual marcado por `aria-current`. */
export const estiloDestino = cn(
  "flex min-h-alvo-consola items-center gap-3 rounded-controlo px-3 py-2 text-corpo text-tinta-suave",
  "transition-colors duration-feedback hover:bg-superficie-alt hover:text-tinta",
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco",
  "aria-[current=page]:bg-accao-suave aria-[current=page]:font-medium aria-[current=page]:text-accao",
  "[&_svg]:size-4 [&_svg]:shrink-0",
);

/** Estilo de uma acção no fim da navegação (botão ou ligação), igual aos destinos. */
export const estiloAccaoConsola = estiloDestino;
