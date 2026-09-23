import { Fragment, useEffect, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import i18n from "./index";
import { idiomaDaRota, inglesAtivo } from "./idiomas";
import { metadadosSeo } from "./rotas";

/**
 * Põe o i18next e o documento no idioma da rota actual.
 *
 * A troca é feita *durante* o render (é síncrona com as traduções no bundle),
 * para a primeira pintura de uma página /en/* já sair em inglês. E a árvore
 * por baixo é remontada quando o idioma muda (`key`), para que nada fique com
 * texto do idioma anterior -- incluindo dados ao nível do módulo, que são lidos
 * com `i18n.t` no momento do render.
 *
 * Também escreve o <head> de SEO: `<html lang>`, título, descrição, canonical
 * e hreflang (ver `metadadosSeo`).
 */
const IdiomaDaRota = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  const idioma = idiomaDaRota(pathname);
  if (i18n.language !== idioma) void i18n.changeLanguage(idioma);
  const { canonical, alternativas } = metadadosSeo(pathname, inglesAtivo());

  // A descrição já existe no index.html (para crawlers sem JavaScript):
  // actualiza-se essa, em vez de o Helmet acrescentar uma segunda.
  useEffect(() => {
    document.querySelector('meta[name="description"]')?.setAttribute("content", i18n.t("meta.descricao"));
  }, [idioma]);

  return (
    <>
      <Helmet htmlAttributes={{ lang: idioma }}>
        <title>{i18n.t("meta.titulo")}</title>
        {canonical && <link rel="canonical" href={canonical} />}
        {alternativas.map((a) => (
          <link key={a.hreflang} rel="alternate" hrefLang={a.hreflang} href={a.href} />
        ))}
      </Helmet>
      <Fragment key={idioma}>{children}</Fragment>
    </>
  );
};

export default IdiomaDaRota;
