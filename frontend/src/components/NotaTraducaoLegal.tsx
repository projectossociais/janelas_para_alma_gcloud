import { useTranslation } from "react-i18next";
import { Aviso } from "@/design/componentes/Aviso";
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
    <Aviso role="note" variante="aviso">
      {t("legal.notaTraducao")}
    </Aviso>
  );
};

export default NotaTraducaoLegal;
