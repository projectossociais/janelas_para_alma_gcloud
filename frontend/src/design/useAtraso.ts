import { useEffect, useState } from "react";

/**
 * `true` só depois de `ms` milissegundos com `activo` ligado. Serve para não
 * mostrar indicadores de carregamento em esperas curtas: um esqueleto que
 * aparece e desaparece em 100 ms é só um piscar (docs/PESQUISA_UX.md §3).
 */
export function useAtraso(activo: boolean, ms: number): boolean {
  const [passou, setPassou] = useState(false);
  useEffect(() => {
    if (!activo) {
      setPassou(false);
      return;
    }
    const id = window.setTimeout(() => setPassou(true), ms);
    return () => window.clearTimeout(id);
  }, [activo, ms]);
  return activo && passou;
}
