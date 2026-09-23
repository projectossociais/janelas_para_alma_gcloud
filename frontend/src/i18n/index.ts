import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ptAO from "./locales/pt-AO.json";
import enUS from "./locales/en-US.json";
import { IDIOMA_EN, IDIOMA_PT, IDIOMAS } from "./idiomas";

/**
 * Traduções incluídas no bundle (são pequenas; não vale a pena carregá-las
 * por rede). Sem detector de idioma do browser: quem decide o idioma é a rota,
 * via `IdiomaDaRota`.
 *
 * `load: "currentOnly"` impede o i18next de procurar também `pt`/`en` genéricos
 * -- só existem `pt-AO` e `en-US`.
 */
void i18n.use(initReactI18next).init({
  resources: {
    [IDIOMA_PT]: { translation: ptAO },
    [IDIOMA_EN]: { translation: enUS },
  },
  lng: IDIOMA_PT,
  fallbackLng: IDIOMA_PT,
  supportedLngs: [...IDIOMAS],
  load: "currentOnly",
  interpolation: { escapeValue: false },
  returnNull: false,
  // en-US.json nasce com os valores vazios ("" = por traduzir): um valor vazio
  // cai para o português em vez de aparecer em branco.
  returnEmptyString: false,
});

export default i18n;
