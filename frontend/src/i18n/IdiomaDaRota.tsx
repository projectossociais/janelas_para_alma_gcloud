import { Fragment, useEffect, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import i18n from "./index";
import { idiomaDaRota } from "./idiomas";

/**
 * Põe o i18next e o documento no idioma da rota actual.
 *
 * A troca é feita *durante* o render (é síncrona com as traduções no bundle),
 * para a primeira pintura de uma página /en/* já sair em inglês. E a árvore
 * por baixo é remontada quando o idioma muda (`key`), para que nada fique com
 * texto do idioma anterior -- incluindo dados ao nível do módulo, que são lidos
 * com `i18n.t` no momento do render.
 */
const IdiomaDaRota = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  const idioma = idiomaDaRota(pathname);
  if (i18n.language !== idioma) void i18n.changeLanguage(idioma);

  useEffect(() => {
    document.documentElement.lang = idioma;
    document.title = i18n.t("meta.titulo");
    document.querySelector('meta[name="description"]')?.setAttribute("content", i18n.t("meta.descricao"));
  }, [idioma]);

  return <Fragment key={idioma}>{children}</Fragment>;
};

export default IdiomaDaRota;
