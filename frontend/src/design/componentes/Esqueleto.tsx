import type { ReactNode } from "react";
import { cn } from "../cn";
import { useAtraso } from "../useAtraso";

/**
 * Forma cinzenta no lugar do conteúdo que está a chegar. Decorativa: o estado
 * "a carregar" anuncia-se com `ZonaACarregar`.
 */
export const Esqueleto = ({ className }: { className?: string }) => (
  <div aria-hidden className={cn("rounded-controlo bg-superficie-alt motion-safe:animate-pulse", className)} />
);

/**
 * Zona de conteúdo que pode estar a carregar (docs/PESQUISA_UX.md §3, Estados):
 * - enquanto carrega, `aria-busy` e um anúncio para leitores de ecrã;
 * - o esqueleto só aparece depois de `atraso` ms (300 por omissão): esperas
 *   curtas não fazem a página piscar;
 * - quando chega, mostra o conteúdo.
 */
export interface ZonaACarregarProps {
  aCarregar: boolean;
  /** Anúncio para leitores de ecrã, ex.: "A carregar os seus treinos". */
  rotulo: string;
  esqueleto: ReactNode;
  children: ReactNode;
  atraso?: number;
  className?: string;
}

export const ZonaACarregar = ({
  aCarregar,
  rotulo,
  esqueleto,
  children,
  atraso = 300,
  className,
}: ZonaACarregarProps) => {
  const mostrarEsqueleto = useAtraso(aCarregar, atraso);
  return (
    <div aria-busy={aCarregar || undefined} className={className}>
      {aCarregar && (
        <p role="status" className="sr-only">
          {rotulo}
        </p>
      )}
      {aCarregar ? mostrarEsqueleto && esqueleto : children}
    </div>
  );
};
