import { Fragment, useEffect, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import i18n from "./index";
import { idiomaDaRota, inglesAtivo } from "./idiomas";
import { metadadosSeo, tituloEDescricao } from "./rotas";

// Metadados que já existem no index.html (para crawlers sem JavaScript):
// actualizam-se esses, em vez de o Helmet acrescentar duplicados.
const META_DESCRICAO = ['meta[name="description"]', 'meta[property="og:description"]', 'meta[name="twitter:description"]'];
const META_TITULO = ['meta[property="og:title"]', 'meta[name="twitter:title"]'];

/**
 * Põe o i18next e o documento no idioma da rota actual.
 *
 * A troca é feita *durante* o render (é síncrona com as traduções no bundle),
 * para a primeira pintura de uma página /en/* já sair em inglês. E a árvore
 * por baixo é remontada quando o idioma muda (`key`), para que nada fique com
 * texto do idioma anterior -- incluindo dados ao nível do módulo, que são lidos
 * com `i18n.t` no momento do render.
 *
 * Também escreve o <head> de SEO: `<html lang>`, título e descrição da página,
 * canonical e hreflang (ver `metadadosSeo`).
 */
const IdiomaDaRota = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  const idioma = idiomaDaRota(pathname);
  if (i18n.language !== idioma) void i18n.changeLanguage(idioma);
  const { canonical, alternativas } = metadadosSeo(pathname, inglesAtivo());
  const { titulo, descricao } = tituloEDescricao(pathname);

  useEffect(() => {
    META_DESCRICAO.forEach((s) => document.querySelector(s)?.setAttribute("content", descricao));
    META_TITULO.forEach((s) => document.querySelector(s)?.setAttribute("content", titulo));
  }, [titulo, descricao]);

  return (
    <>
      <Helmet htmlAttributes={{ lang: idioma }}>
        <title>{titulo}</title>
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
