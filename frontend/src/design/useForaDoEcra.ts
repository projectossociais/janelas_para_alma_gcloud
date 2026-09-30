import { useEffect, useState, type RefObject } from "react";

/**
 * `true` quando o elemento já saiu do ecrã por cima (a pessoa desceu para lá
 * dele). Usa IntersectionObserver: nada corre a cada scroll. Serve para mostrar
 * a barra da acção principal no telemóvel só depois de a abertura, que já tem
 * esse botão, deixar de estar à vista.
 */
export function useForaDoEcra(ref: RefObject<Element | null>): boolean {
  const [fora, setFora] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observador = new IntersectionObserver(([entrada]) => {
      if (!entrada) return;
      setFora(!entrada.isIntersecting && entrada.boundingClientRect.top < 0);
    });
    observador.observe(el);
    return () => observador.disconnect();
  }, [ref]);
  return fora;
}
