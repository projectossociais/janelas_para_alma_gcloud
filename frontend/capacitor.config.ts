import type { CapacitorConfig } from "@capacitor/cli";

/**
 * App nativa (Google Play e App Store) -- ver docs/APP_LOJAS.md.
 *
 * A app abre o site publicado (`server.url`) em vez de levar uma cópia do build
 * dentro dela. É de propósito: o browser fala sempre com `/api/*` na mesma
 * origem e a sessão viaja em cookies `httpOnly` (CLAUDE.md §2 e §3b). Com o
 * build dentro da app, a origem passaria a ser `https://localhost`/
 * `capacitor://localhost` e os cookies de sessão deixavam de chegar à API.
 * Vantagem extra: cada deploy do Vercel chega logo à app, sem nova versão nas
 * lojas -- só uma mudança nativa (ícone, permissões, plugins) exige uma.
 *
 * `webDir` só leva a página de "sem ligação" (`app-nativa/www`), mostrada
 * quando o site não carrega (`errorPath`).
 */
const config: CapacitorConfig = {
  appId: "com.janelasparaalma.app",
  appName: "Janelas Para a Alma",
  webDir: "app-nativa/www",
  server: {
    url: "https://www.janelasparaalma.com",
    // Só estes domínios abrem dentro da app; qualquer outro (WhatsApp, BAI,
    // redes sociais) abre no browser do telemóvel.
    allowNavigation: ["www.janelasparaalma.com", "janelasparaalma.com"],
    errorPath: "sem-ligacao.html",
  },
  backgroundColor: "#001F54",
  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: "always",
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: "#FFFFFF",
      showSpinner: false,
    },
    StatusBar: {
      backgroundColor: "#001F54",
      style: "DARK",
      overlaysWebView: false,
    },
  },
};

export default config;
