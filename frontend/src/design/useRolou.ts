import { useEffect, useState } from "react";

/**
 * `true` quando a página já rolou mais do que `limiar` px. Um só ouvinte
 * passivo, lido uma vez por frame: não pesa no scroll de telemóveis modestos.
 */
export function useRolou(limiar = 8): boolean {
  const [rolou, setRolou] = useState(false);
  useEffect(() => {
    let pedido = 0;
    const ler = () => {
      pedido = 0;
      setRolou(window.scrollY > limiar);
    };
    const aoRolar = () => {
      if (!pedido) pedido = window.requestAnimationFrame(ler);
    };
    ler();
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => {
      window.removeEventListener("scroll", aoRolar);
      if (pedido) window.cancelAnimationFrame(pedido);
    };
  }, [limiar]);
  return rolou;
}
