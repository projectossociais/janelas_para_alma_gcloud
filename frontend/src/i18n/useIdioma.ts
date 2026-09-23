import { useLocation } from "react-router-dom";
import { idiomaDaRota, type Idioma } from "./idiomas";

/** Idioma da página actual, derivado da rota. */
export function useIdioma(): Idioma {
  return idiomaDaRota(useLocation().pathname);
}
