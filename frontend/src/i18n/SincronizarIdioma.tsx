import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import i18n from "./index";
import { idiomaDaRota } from "./idiomas";

/**
 * Mantém o i18next e o `<html lang>` alinhados com a rota actual. Não
 * renderiza nada; vive dentro do `BrowserRouter`.
 */
const SincronizarIdioma = () => {
  const { pathname } = useLocation();
  const idioma = idiomaDaRota(pathname);

  useEffect(() => {
    if (i18n.language !== idioma) void i18n.changeLanguage(idioma);
    document.documentElement.lang = idioma;
  }, [idioma]);

  return null;
};

export default SincronizarIdioma;
