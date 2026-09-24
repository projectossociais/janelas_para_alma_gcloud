import { generatePath, matchPath } from "react-router-dom";
import i18n from "./index";
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
 * - `apenasPt`: a página existe no mapa mas ainda não tem versão inglesa (não
 *   há rota /en/..., o botão de idioma leva à página inicial inglesa e os
 *   links para ela escondem-se no site inglês). O `en` fica reservado.
 *   Hoje nenhuma página o usa: o jogo foi a última, até ser traduzido
 *   (2026-09-24).
 * - `foraDoSitemap`: páginas de conta, fluxos e resultados -- existem nos dois
 *   idiomas mas não se pedem ao Google.
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
  { chave: "exercicioEstereopsia", pt: "/exercicios/estereopsia", en: "/en/exercises/stereopsis" },
  { chave: "scanner", pt: "/scanner", en: "/en/scanner" },
  { chave: "scannerResultados", pt: "/scanner/resultados", en: "/en/scanner/results", foraDoSitemap: true },
  { chave: "entrar", pt: "/login", en: "/en/sign-in", foraDoSitemap: true },
  { chave: "atualizarPassword", pt: "/atualizar-password", en: "/en/reset-password", foraDoSitemap: true },
  { chave: "confirmarEmail", pt: "/confirmar-email", en: "/en/confirm-email", foraDoSitemap: true },
  { chave: "apoiar", pt: "/apoiar", en: "/en/donate" },
  { chave: "configuracoes", pt: "/configuracoes", en: "/en/settings", foraDoSitemap: true },
  { chave: "editarPerfil", pt: "/editar-perfil", en: "/en/edit-profile", foraDoSitemap: true },
  { chave: "politicaPrivacidade", pt: "/politica-de-privacidade", en: "/en/privacy-policy" },
  { chave: "termosUtilizacao", pt: "/termos-de-utilizacao", en: "/en/terms-of-use" },
  { chave: "faq", pt: "/faq", en: "/en/faq" },
  { chave: "impacto", pt: "/impacto", en: "/en/impact" },
  { chave: "junteSe", pt: "/junte-se", en: "/en/contact" },
  { chave: "registoPremium", pt: "/registo-premium", en: "/en/premium-sign-up", foraDoSitemap: true },
  { chave: "dashboard", pt: "/dashboard", en: "/en/dashboard", foraDoSitemap: true },
  { chave: "dashboardPro", pt: "/dashboard-pro", en: "/en/dashboard-pro", foraDoSitemap: true },
  { chave: "jogoMenu", pt: "/jogo-curiosidades", en: "/en/trivia-game" },
  { chave: "jogoJogar", pt: "/jogo-curiosidades/jogar", en: "/en/trivia-game/play", foraDoSitemap: true },
  { chave: "jogoPerfil", pt: "/jogo-curiosidades/perfil", en: "/en/trivia-game/profile", foraDoSitemap: true },
  { chave: "jogoLoja", pt: "/jogo-curiosidades/loja", en: "/en/trivia-game/shop", foraDoSitemap: true },
  { chave: "jogoLojaMoedas", pt: "/jogo-curiosidades/loja-moedas", en: "/en/trivia-game/coin-shop", foraDoSitemap: true },
] as const;

export type ChaveRota = (typeof ROTAS)[number]["chave"];

type Rota = { chave: ChaveRota; pt: string; en: string; apenasPt?: boolean; foraDoSitemap?: boolean };
const LISTA: readonly Rota[] = ROTAS;

/** Páginas com versão inglesa (as que geram rota /en/... e hreflang). */
export const ROTAS_BILINGUES: readonly Rota[] = LISTA.filter((r) => !r.apenasPt);

/** Páginas a pedir ao Google no sitemap. */
export const ROTAS_SITEMAP: readonly Rota[] = LISTA.filter((r) => !r.foraDoSitemap && !r.pt.includes(":"));

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

const rotaDe = (chave: ChaveRota): Rota => LISTA.find((r) => r.chave === chave)!;

function caminhoDe(chave: ChaveRota, idioma: Idioma): string {
  const rota = rotaDe(chave);
  return idioma === IDIOMA_EN ? rota.en : rota.pt;
}

/**
 * O mesmo sítio noutro idioma, preservando parâmetros (`:slug`), query string
 * e âncora. Uma página fora do mapa (ex.: `/admin`) leva à página inicial do
 * idioma de destino -- nunca a um URL inventado que daria 404 -- a não ser que
 * se peça `foraDoMapa: "manter"` (links internos para páginas só em PT).
 */
export function caminhoNoIdioma(
  url: string,
  destino: Idioma,
  { foraDoMapa = "inicio" }: { foraDoMapa?: "inicio" | "manter" } = {},
): string {
  const parsed = new URL(url, "http://x");
  const { pathname, search, hash } = parsed;
  const origemEn = eRotaInglesa(pathname);

  const candidatas = origemEn
    ? ROTAS_BILINGUES.map((r) => ({ chave: r.chave, padrao: r.en }))
    : ENTRADAS_PT.map((r) => ({ chave: r.chave, padrao: r.pt }));

  for (const { chave, padrao } of candidatas) {
    const match = matchPath({ path: padrao, end: true }, pathname);
    if (match) {
      // página só em português: não há equivalente inglês -> página inicial inglesa
      if (destino === IDIOMA_EN && rotaDe(chave).apenasPt) return caminhoDe("inicio", destino);
      return generatePath(caminhoDe(chave, destino), match.params) + search + hash;
    }
  }
  return foraDoMapa === "manter" ? url : caminhoDe("inicio", destino);
}

/**
 * Chave do mapa da página em `pathname` (PT, alias PT ou EN), ou `null` para
 * páginas fora do mapa (admin, 404). É o que liga cada página ao seu título e
 * descrição (`seo.<chave>Titulo` / `seo.<chave>Descricao`).
 */
export function chaveDaRota(pathname: string): ChaveRota | null {
  const candidatas = eRotaInglesa(pathname)
    ? ROTAS_BILINGUES.map((r) => ({ chave: r.chave, padrao: r.en }))
    : ENTRADAS_PT.map((r) => ({ chave: r.chave, padrao: r.pt }));
  return candidatas.find(({ padrao }) => matchPath({ path: padrao, end: true }, pathname))?.chave ?? null;
}

/**
 * Título e descrição da página em `pathname`, no idioma actual. Cada página do
 * mapa tem os seus (`seo.<chave>Titulo` / `seo.<chave>Descricao`); a página
 * inicial e as páginas fora do mapa (admin, 404) usam os do site (`meta.*`).
 */
export function tituloEDescricao(pathname: string): { titulo: string; descricao: string } {
  const chave = chaveDaRota(pathname);
  if (!chave || chave === "inicio") return { titulo: i18n.t("meta.titulo"), descricao: i18n.t("meta.descricao") };
  return {
    titulo: i18n.t("seo.modeloTitulo", { pagina: i18n.t(`seo.${chave}Titulo`) }),
    descricao: i18n.t(`seo.${chave}Descricao`),
  };
}

export const caminhoEmIngles = (url: string) => caminhoNoIdioma(url, IDIOMA_EN);
export const caminhoEmPortugues = (url: string) => caminhoNoIdioma(url, IDIOMA_PT);

/**
 * Link interno escrito em português, no idioma da página actual. É o que os
 * componentes usam em `to`, `href` e `navigate(...)`: em português devolve o
 * caminho tal como está; em inglês devolve o equivalente `/en/...`. Páginas
 * fora do mapa (admin, roadmap) ficam como estão.
 */
export function localizar(caminhoPt: string): string {
  if (i18n.language !== IDIOMA_EN) return caminhoPt;
  const pathname = new URL(caminhoPt, "http://x").pathname;
  if (eRotaInglesa(pathname)) return caminhoPt;
  // Página só em português: fica o caminho PT, para `disponivelNoIdiomaActual`
  // o reconhecer e o link ser escondido (em vez de levar à página inicial).
  if (LISTA.some((r) => r.apenasPt && matchPath({ path: r.pt, end: true }, pathname))) return caminhoPt;
  return caminhoNoIdioma(caminhoPt, IDIOMA_EN, { foraDoMapa: "manter" });
}

/**
 * `false` para links que, no site inglês, levariam a uma página só em
 * português (ex.: o jogo). Os componentes usam-no para esconder esses pontos
 * de entrada; em português é sempre `true`.
 */
export function disponivelNoIdiomaActual(caminho: string): boolean {
  if (i18n.language !== IDIOMA_EN) return true;
  const pathname = new URL(caminho, "http://x").pathname;
  return !LISTA.some((r) => r.apenasPt && matchPath({ path: r.pt, end: true }, pathname));
}

// Host final de produção: https://janelasparaalma.com responde 308 para o www,
// e canonical/hreflang/sitemap têm de apontar para o URL final, não para um
// redireccionamento.
export const SITE = "https://www.janelasparaalma.com";

export type MetadadosSeo = {
  /** URL canónico absoluto da página no idioma em que está. */
  canonical: string | null;
  /** Alternativas de idioma (hreflang), vazias se a página não tem par. */
  alternativas: { hreflang: string; href: string }[];
};

/**
 * canonical + hreflang de uma rota. As alternativas só existem para páginas
 * com versão inglesa e com a versão inglesa ligada; saem do mesmo par do mapa
 * de rotas, por isso são recíprocas por construção (a página PT e a página EN
 * de um par devolvem exactamente o mesmo conjunto). Aliases apontam para o
 * URL canónico da página. Páginas fora do mapa (admin, 404) não têm nada.
 */
export function metadadosSeo(pathname: string, enAtivo: boolean): MetadadosSeo {
  const origemEn = eRotaInglesa(pathname);
  const candidatas: { rota: Rota; padrao: string }[] = origemEn
    ? ROTAS_BILINGUES.map((r) => ({ rota: r, padrao: r.en }))
    : ENTRADAS_PT.map((e) => ({ rota: rotaDe(e.chave), padrao: e.pt }));

  for (const { rota, padrao } of candidatas) {
    const match = matchPath({ path: padrao, end: true }, pathname);
    if (!match) continue;
    const pt = SITE + generatePath(rota.pt, match.params);
    const bilingue = enAtivo && !rota.apenasPt;
    if (!bilingue) return { canonical: origemEn ? null : pt, alternativas: [] };
    const en = SITE + generatePath(rota.en, match.params);
    return {
      canonical: origemEn ? en : pt,
      alternativas: [
        { hreflang: IDIOMA_PT, href: pt },
        { hreflang: IDIOMA_EN, href: en },
        { hreflang: "x-default", href: pt },
      ],
    };
  }
  return { canonical: null, alternativas: [] };
}
