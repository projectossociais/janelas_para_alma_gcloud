import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { IDIOMA_EN, IDIOMA_PT, inglesAtivo } from "@/i18n/idiomas";
import { caminhoNoIdioma } from "@/i18n/rotas";
import { useIdioma } from "@/i18n/useIdioma";
import { Ligacao } from "@/design/Ligacao";

/**
 * Troca de idioma do site novo: leva à mesma página no outro idioma (mesma
 * regra do rodapé antigo, `src/i18n/rotas.ts`). Só aparece com o inglês
 * activo (VITE_ENABLE_EN=true).
 */
export const AlternarIdioma = () => {
  const { t } = useTranslation();
  const { pathname, search, hash } = useLocation();
  const destino = useIdioma() === IDIOMA_PT ? IDIOMA_EN : IDIOMA_PT;
  if (!inglesAtivo()) return null;
  return (
    <Ligacao
      href={caminhoNoIdioma(pathname + search + hash, destino)}
      hrefLang={destino}
      lang={destino === IDIOMA_EN ? "en" : "pt"}
      aria-label={t("idioma.alternarRotulo")}
      className="inline-flex min-h-alvo-app items-center rounded-controlo px-2 text-legenda font-medium text-tinta-suave hover:text-tinta focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco"
    >
      {t("idioma.alternar")}
    </Ligacao>
  );
};
