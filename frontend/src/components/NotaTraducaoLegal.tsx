import { useTranslation } from "react-i18next";
import { IDIOMA_EN } from "@/i18n/idiomas";
import { useIdioma } from "@/i18n/useIdioma";

/**
 * Aviso nas páginas legais traduzidas: a versão portuguesa é a que vale. Só
 * aparece no site inglês -- em português não há nada a avisar.
 */
const NotaTraducaoLegal = () => {
  const { t } = useTranslation();
  if (useIdioma() !== IDIOMA_EN) return null;
  return (
    <p role="note" className="mt-4 max-w-2xl mx-auto rounded-lg border border-gold/40 bg-gold/10 px-4 py-2 text-sm text-foreground">
      {t("legal.notaTraducao")}
    </p>
  );
};

export default NotaTraducaoLegal;
