import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/** Quanto tempo esperar por uma secção que só aparece depois de a página carregar. */
const ESPERA_MAXIMA_MS = 1500;
const INTERVALO_MS = 100;

/**
 * Página nova começa no topo; um link com âncora (`/impacto#sobre`, os menus
 * do cabeçalho) leva à secção, também quando já se está na mesma página.
 */
const ScrollToTop = () => {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
      return;
    }
    const id = decodeURIComponent(hash.slice(1));
    let esperado = 0;
    const procurar = window.setInterval(() => {
      const alvo = document.getElementById(id);
      esperado += INTERVALO_MS;
      if (alvo) alvo.scrollIntoView({ behavior: "smooth", block: "start" });
      if (alvo || esperado >= ESPERA_MAXIMA_MS) window.clearInterval(procurar);
    }, INTERVALO_MS);
    return () => window.clearInterval(procurar);
  }, [pathname, hash]);

  return null;
};

export default ScrollToTop;
