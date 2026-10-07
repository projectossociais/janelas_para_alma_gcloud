import { useCallback, useEffect, useState } from "react";

export type PreferenciaTema = "sistema" | "claro" | "escuro";
export type TemaEfectivo = "claro" | "escuro";

const CHAVE = "jpa-tema";
const CONSULTA_ESCURO = "(prefers-color-scheme: dark)";

/** Lê a preferência guardada; sem acesso ao armazenamento, segue o sistema. */
export function lerPreferencia(): PreferenciaTema {
  try {
    const v = window.localStorage.getItem(CHAVE);
    return v === "claro" || v === "escuro" ? v : "sistema";
  } catch {
    return "sistema";
  }
}

/**
 * Aplica a preferência à página: `data-tema` no <html> (lido por tokens.css).
 * "sistema" retira o atributo e deixa o tokens.css seguir o sistema operativo.
 */
export function aplicarPreferencia(p: PreferenciaTema): void {
  const raiz = document.documentElement;
  if (p === "sistema") delete raiz.dataset.tema;
  else raiz.dataset.tema = p;
}

const sistemaEscuro = () =>
  typeof window.matchMedia === "function" && window.matchMedia(CONSULTA_ESCURO).matches;

/**
 * Preferência de tema da pessoa (sistema, claro ou escuro), guardada no
 * browser e aplicada à página. `efectivo` diz qual está de facto visível,
 * mesmo em "sistema" (actualiza quando o sistema muda).
 */
export function useTema() {
  const [preferencia, setPreferencia] = useState<PreferenciaTema>(lerPreferencia);
  const [escuroNoSistema, setEscuroNoSistema] = useState(sistemaEscuro);

  useEffect(() => {
    aplicarPreferencia(preferencia);
  }, [preferencia]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const consulta = window.matchMedia(CONSULTA_ESCURO);
    const mudou = () => setEscuroNoSistema(consulta.matches);
    consulta.addEventListener("change", mudou);
    return () => consulta.removeEventListener("change", mudou);
  }, []);

  const definir = useCallback((p: PreferenciaTema) => {
    setPreferencia(p);
    try {
      if (p === "sistema") window.localStorage.removeItem(CHAVE);
      else window.localStorage.setItem(CHAVE, p);
    } catch {
      // Sem armazenamento (modo privado, bloqueado): vale só nesta visita.
    }
  }, []);

  const efectivo: TemaEfectivo =
    preferencia === "sistema" ? (escuroNoSistema ? "escuro" : "claro") : preferencia;

  return { preferencia, efectivo, definir };
}
