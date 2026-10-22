import { useRef, type PointerEvent } from "react";
import { PRESSAO_LONGA_MS, direccaoDoGesto, type RespostaE } from "@/lib/visao/palancaLonge";

/**
 * Deslizes no ecrã como resposta: a direcção do deslize, ou "não sabe" se o
 * dedo ficar parado `PRESSAO_LONGA_MS`. Para quem segura o telemóvel virado
 * para a criança e não vê o ecrã.
 */
export function useGestos(aoGesto: (r: RespostaE) => void) {
  const inicio = useRef<{ x: number; y: number } | null>(null);
  const temporizador = useRef<number | undefined>(undefined);
  const aoGestoRef = useRef(aoGesto);
  aoGestoRef.current = aoGesto;

  const limpar = () => {
    window.clearTimeout(temporizador.current);
    inicio.current = null;
  };

  return {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if ((e.target as HTMLElement).closest("button")) return;
      inicio.current = { x: e.clientX, y: e.clientY };
      window.clearTimeout(temporizador.current);
      temporizador.current = window.setTimeout(() => {
        if (!inicio.current) return;
        inicio.current = null;
        aoGestoRef.current("naosabe");
      }, PRESSAO_LONGA_MS);
    },
    onPointerUp: (e: PointerEvent<HTMLElement>) => {
      const i = inicio.current;
      limpar();
      if (!i) return;
      const d = direccaoDoGesto(e.clientX - i.x, e.clientY - i.y);
      if (d) aoGestoRef.current(d);
    },
    onPointerCancel: limpar,
  };
}
