import { generatePath, matchPath } from "react-router-dom";
import { IDIOMA_EN, IDIOMA_PT, eRotaInglesa, type Idioma } from "./idiomas";

/**
 * Mapa de rotas PT <-> EN -- fonte única. `App.tsx` gera as rotas a partir
 * daqui e o botão de idioma do rodapé usa-o para levar à mesma página no
 * outro idioma.
 *
 * Regras:
 * - Cada `chave` é uma página; o elemento que a renderiza vive em `App.tsx`.
 * - Parâmetros (`:slug`) têm de ter o mesmo nome nos dois lados.
 * - Uma página só existe em inglês se estiver aqui. O painel de administração
 *   e o roadmap técnico são internos e ficam de fora de propósito.
 */
export const ROTAS = [
  { chave: "inicio", pt: "/", en: "/en" },
  { chave: "sobre", pt: "/sobre", en: "/en/about" },
  { chave: "equipa", pt: "/equipa", en: "/en/team" },
  { chave: "kamba", pt: "/kamba", en: "/en/kamba" },
  { chave: "campanhaGamek", pt: "/meu-kamba/campanha-gamek", en: "/en/kamba/gamek-campaign" },
  { chave: "publicacoes", pt: "/publicacoes", en: "/en/publications" },
  { chave: "publicacaoDetalhe", pt: "/publicacoes/:slug", en: "/en/publications/:slug" },
  { chave: "parceiros", pt: "/parceiros", en: "/en/partners" },
  { chave: "portalClinico", pt: "/portal-clinico", en: "/en/clinical-portal" },
  { chave: "portalClinicoOptioptika", pt: "/portal-clinico/optioptika", en: "/en/clinical-portal/optioptika" },
  { chave: "tecnologia", pt: "/tecnologia", en: "/en/technology" },
  { chave: "circular", pt: "/circular", en: "/en/circular-economy" },
  { chave: "suporte", pt: "/suporte", en: "/en/support" },
  { chave: "exercicios", pt: "/exercicios", en: "/en/exercises" },
  { chave: "exercicioConvergencia", pt: "/exercicios/convergencia", en: "/en/exercises/convergence" },
  { chave: "exercicioCerebro", pt: "/exercicios/cerebro", en: "/en/exercises/brain" },
  { chave: "exercicioTracking", pt: "/exercicios/tracking", en: "/en/exercises/tracking" },
  { chave: "exercicioRelaxamento", pt: "/exercicios/relaxamento", en: "/en/exercises/relaxation" },
  { chave: "exercicioAmbliopia", pt: "/exercicios/ambliopia", en: "/en/exercises/amblyopia" },
  { chave: "exercicioSacadasConvergencia", pt: "/exercicios/sacadas-convergencia", en: "/en/exercises/convergence-saccades" },
  { chave: "exercicioFlexibilidadeAcomodativa", pt: "/exercicios/flexibilidade-acomodativa", en: "/en/exercises/accommodative-flexibility" },
  { chave: "exercicioSacadasDistratores", pt: "/exercicios/sacadas-distratores", en: "/en/exercises/distractor-saccades" },
  { chave: "exercicioEstereopsia", pt: "/exercicios/estereopsia", en: "/en/exercises/stereopsis" },
  { chave: "exercicioFacilidadeVergencia", pt: "/exercicios/facilidade-vergencia", en: "/en/exercises/vergence-facility" },
  { chave: "exercicioConscienciaPeriferica", pt: "/exercicios/consciencia-periferica", en: "/en/exercises/peripheral-awareness" },
  { chave: "exercicioProgramaIa", pt: "/exercicios/programa-ia", en: "/en/exercises/ai-program" },
  { chave: "scanner", pt: "/scanner", en: "/en/scanner" },
  { chave: "scannerResultados", pt: "/scanner/resultados", en: "/en/scanner/results" },
  { chave: "entrar", pt: "/login", en: "/en/sign-in" },
  { chave: "atualizarPassword", pt: "/atualizar-password", en: "/en/reset-password" },
  { chave: "confirmarEmail", pt: "/confirmar-email", en: "/en/confirm-email" },
  { chave: "apoiar", pt: "/apoiar", en: "/en/donate" },
  { chave: "configuracoes", pt: "/configuracoes", en: "/en/settings" },
  { chave: "editarPerfil", pt: "/editar-perfil", en: "/en/edit-profile" },
  { chave: "politicaPrivacidade", pt: "/politica-de-privacidade", en: "/en/privacy-policy" },
  { chave: "termosUtilizacao", pt: "/termos-de-utilizacao", en: "/en/terms-of-use" },
  { chave: "faq", pt: "/faq", en: "/en/faq" },
  { chave: "impacto", pt: "/impacto", en: "/en/impact" },
  { chave: "junteSe", pt: "/junte-se", en: "/en/contact" },
  { chave: "registoPremium", pt: "/registo-premium", en: "/en/premium-sign-up" },
  { chave: "dashboard", pt: "/dashboard", en: "/en/dashboard" },
  { chave: "dashboardPro", pt: "/dashboard-pro", en: "/en/dashboard-pro" },
  { chave: "jogoMenu", pt: "/jogo-curiosidades", en: "/en/trivia-game" },
  { chave: "jogoJogar", pt: "/jogo-curiosidades/jogar", en: "/en/trivia-game/play" },
  { chave: "jogoPerfil", pt: "/jogo-curiosidades/perfil", en: "/en/trivia-game/profile" },
] as const;

export type ChaveRota = (typeof ROTAS)[number]["chave"];

/**
 * Caminhos portugueses antigos que renderizam uma página do mapa mas não são
 * o seu URL canónico. Continuam a funcionar em português; o equivalente
 * inglês é o da página para onde apontam.
 */
export const ALIASES_PT: readonly { pt: string; chave: ChaveRota }[] = [
  { pt: "/auth", chave: "entrar" },
  { pt: "/registo", chave: "entrar" },
  { pt: "/update-password", chave: "atualizarPassword" },
];

type Entrada = { chave: ChaveRota; pt: string; en?: string };

const ENTRADAS_PT: readonly Entrada[] = [...ROTAS, ...ALIASES_PT];

function caminhoDe(chave: ChaveRota, idioma: Idioma): string {
  const rota = ROTAS.find((r) => r.chave === chave)!;
  return idioma === IDIOMA_EN ? rota.en : rota.pt;
}

/**
 * O mesmo sítio noutro idioma, preservando parâmetros (`:slug`), query string
 * e âncora. Uma página fora do mapa (ex.: `/admin`) leva à página inicial do
 * idioma de destino -- nunca a um URL inventado que daria 404.
 */
export function caminhoNoIdioma(url: string, destino: Idioma): string {
  const parsed = new URL(url, "http://x");
  const { pathname, search, hash } = parsed;
  const origemEn = eRotaInglesa(pathname);

  const candidatas = origemEn
    ? ROTAS.map((r) => ({ chave: r.chave, padrao: r.en as string }))
    : ENTRADAS_PT.map((r) => ({ chave: r.chave, padrao: r.pt }));

  for (const { chave, padrao } of candidatas) {
    const match = matchPath({ path: padrao, end: true }, pathname);
    if (match) {
      return generatePath(caminhoDe(chave, destino), match.params) + search + hash;
    }
  }
  return caminhoDe("inicio", destino);
}

export const caminhoEmIngles = (url: string) => caminhoNoIdioma(url, IDIOMA_EN);
export const caminhoEmPortugues = (url: string) => caminhoNoIdioma(url, IDIOMA_PT);
