import type { TFunction } from "i18next";
import { IDIOMA_PT } from "@/i18n/idiomas";
import { ROTAS, localizar, type ChaveRota } from "@/i18n/rotas";
import { MENU_DOAR, MENU_PRINCIPAL } from "@/lib/menuPrincipal";
import type { ClinicaParceiraPublica, PublicacaoPublica } from "@/lib/apiClient";
import type { EntradaPesquisa } from "./procurar";

/**
 * O que a lupa do cabeçalho procura. Em vez de uma lista escrita à mão (que
 * ficou desactualizada: apontava para páginas antigas e não conhecia os
 * exercícios, o jogo, o Premium nem a FAQ), o índice é **gerado**:
 *
 * - **Páginas**: do mapa de rotas (`i18n/rotas.ts`), com o título e a
 *   descricao que cada página já tem (`seo.<chave>Titulo/Descricao`). Uma
 *   página nova no mapa tem de entrar em `PAGINAS` ou em `FORA_DA_PESQUISA`
 *   -- há um teste que o exige, para a pesquisa nunca voltar a ficar para trás.
 * - **Texto das páginas**: os textos de tradução que cada página mostra
 *   (`seccoes`), para se encontrar o que está escrito lá dentro.
 * - **Secções**: os destinos do menu com âncora, mais `SECCOES`.
 * - **Perguntas frequentes**: cada pergunta, com a resposta como texto.
 * - **Publicações e clínicas**: vêm da API (`entradasDaApi`).
 */

export interface ContextoPesquisa {
  comSessao: boolean;
  /** Papel da conta com sessão (`profissional`, `admin`...). */
  papel?: string | null;
}

type Quem = "sessao" | "utilizador" | "profissional";

interface PaginaPesquisavel {
  /** Secções de tradução com o texto que a página mostra. */
  seccoes?: readonly string[];
  /** Só aparece a quem pode abrir a página. */
  quem?: Quem;
  exercicio?: boolean;
}

export const PAGINAS: Partial<Record<ChaveRota, PaginaPesquisavel>> = {
  inicio: {
    seccoes: ["StrabismusIntroCard", "AboutTeaserSection", "PillarsSection", "CuriosidadesSection", "ParceirosSection"],
  },
  sobre: { seccoes: ["StrabismusSection"] },
  equipa: { seccoes: ["TeamSection"] },
  kamba: { seccoes: ["KambaHeroCarousel", "VolunteerSection", "ProgramModal", "ActivitiesFeed", "UpcomingActivities"] },
  campanhaGamek: { seccoes: ["CampanhaGamek"] },
  publicacoes: { seccoes: ["Publicacoes"] },
  parceiros: { seccoes: ["Parceiros", "ClinicalPartners"] },
  registoParceiro: { seccoes: ["RegistoParceiro"] },
  portalClinicoOptioptika: { seccoes: ["PortalClinicoOptioptika", "optioptika"] },
  tecnologia: { seccoes: ["Tecnologia"] },
  circular: { seccoes: ["Circular", "PontosRecolha"] },
  suporte: { seccoes: ["Suporte"] },
  exercicios: { seccoes: ["Exercicios"] },
  exercicioAcuidade: { exercicio: true },
  exercicioContraste: { exercicio: true },
  exercicioAstigmatismo: { exercicio: true },
  exercicioEstereopsia: { exercicio: true },
  exercicioAneis: { exercicio: true },
  exercicioContrasteBlocos: { exercicio: true },
  exercicioConvergencia: { exercicio: true },
  exercicioPertoLonge: { exercicio: true },
  exerciciosProgresso: { quem: "sessao" },
  exerciciosRelatorio: { quem: "sessao" },
  scanner: { seccoes: ["Scanner"] },
  entrar: {},
  apoiar: { seccoes: ["Apoiar", "ApoioMensal", "PontosRecolha"] },
  configuracoes: { quem: "sessao" },
  editarPerfil: { quem: "sessao" },
  politicaPrivacidade: { seccoes: ["PoliticaPrivacidade"] },
  termosUtilizacao: { seccoes: ["TermosUtilizacao"] },
  faq: {},
  impacto: { seccoes: ["Impacto", "AboutSection", "ImpactSection"] },
  junteSe: { seccoes: ["ContactSection"] },
  registoPremium: { seccoes: ["RegistoPremium"] },
  dashboard: { quem: "utilizador" },
  dashboardPro: { quem: "profissional" },
  jogoMenu: { seccoes: ["MenuJogo", "JogoCuriosidades"] },
  jogoJogar: {},
  jogoLocal: {},
  jogoOnline: { quem: "sessao" },
  jogoPerfil: { quem: "sessao" },
  jogoLoja: { quem: "sessao" },
  jogoLojaMoedas: { quem: "sessao" },
};

/**
 * Páginas do mapa que a pesquisa não mostra, de propósito:
 * - `publicacaoDetalhe`, `relatorioPartilhado`: precisam de um slug ou de um
 *   token (as publicações entram uma a uma, pela API).
 * - `portalClinico`: é a mesma página que `parceiros`.
 * - `scannerResultados`, `atualizarPassword`, `confirmarEmail`: passos de um
 *   fluxo, sem sentido abertos a frio.
 * - `rastreioCompleto`: só para testes com voluntários, sem ligação nenhuma no
 *   site (CLAUDE.md, secção 1). Não pôr aqui sem as fases V1 e V2.
 */
export const FORA_DA_PESQUISA: readonly ChaveRota[] = [
  "publicacaoDetalhe",
  "relatorioPartilhado",
  "portalClinico",
  "scannerResultados",
  "atualizarPassword",
  "confirmarEmail",
  "rastreioCompleto",
];

/** Secções com âncora que não estão no menu do cabeçalho. */
export const SECCOES: readonly { id: string; caminho: string; rotulo: string; descricao: string; palavras?: string }[] = [
  {
    id: "voluntariado",
    caminho: "/kamba#voluntariado",
    rotulo: "Cabecalho.voluntario",
    descricao: "Cabecalho.voluntarioDescricao",
    palavras: "Pesquisa.palavras.voluntariado",
  },
  {
    id: "clinicas",
    caminho: "/parceiros#parceiros-clinicos",
    rotulo: "Cabecalho.clinicasParceiras",
    descricao: "Cabecalho.clinicasParceirasDescricao",
    palavras: "Pesquisa.palavras.clinicas",
  },
];

/** Palavras-chave dos destinos do menu com âncora ou `?modo=`. */
const PALAVRAS_DO_MENU: Record<string, string> = {
  "/impacto#sobre": "Pesquisa.palavras.jornada",
  "/junte-se#contacto": "Pesquisa.palavras.contacto",
  "/publicacoes#artigos": "Cabecalho.pesquisaBlogPalavras",
  "/apoiar?modo=unica": "Cabecalho.pesquisaDoarPalavras",
  "/apoiar?modo=mensal": "Cabecalho.pesquisaDoarPalavras",
};

/** Pergunta e resposta de cada item de `pages/Faq.tsx`. */
export const PERGUNTAS_FAQ: readonly (readonly [pergunta: string, resposta: string])[] = [
  ["Faq.osMeusDadosDe", "Faq.simOsDadosDe"],
  ["Faq.possoApagarAMinha", "Faq.simAQualquerMomento"],
  ["Faq.oResultadoDaTriagem", "Faq.naoORastreioDigital"],
  ["Faq.aPlataformaPartilhaOs", "Faq.soQuandoOUtilizador"],
  ["Faq.oSiteUtilizaCookies", "Faq.utilizamosApenasCookiesTecnicos"],
];

/** O que aparece antes de se escrever (ids de entradas do índice). */
export const SUGESTOES: readonly string[] = [
  "pagina:scanner",
  "pagina:exercicios",
  "pagina:parceiros",
  "pagina:apoiar",
  "pagina:faq",
  "menu:/junte-se#contacto",
];

/** Tira as tags do `<Trans>` e as variáveis `{{x}}` de um texto de tradução. */
const limpar = (s: string) =>
  s
    .replace(/<\/?[\w]+\s*\/?>/g, "")
    .replace(/\{\{\s*[\w.]+\s*\}\}/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Todos os textos de uma secção de tradução (rótulos de uma só palavra não interessam). */
function textosDaSeccao(t: TFunction, seccao: string): string[] {
  const out: string[] = [];
  const percorrer = (no: unknown) => {
    if (typeof no === "string") {
      const texto = limpar(no);
      if (texto.includes(" ") && texto.length >= 8) out.push(texto);
    } else if (no && typeof no === "object") Object.values(no).forEach(percorrer);
  };
  percorrer(t(seccao, { returnObjects: true }));
  return out;
}

function podeVer(quem: Quem | undefined, { comSessao, papel }: ContextoPesquisa): boolean {
  if (!quem) return true;
  if (!comSessao) return false;
  if (quem === "profissional") return papel === "profissional";
  if (quem === "utilizador") return papel !== "profissional" && papel !== "admin";
  return true;
}

const opcional = (t: TFunction, chave: string | undefined) => {
  if (!chave) return undefined;
  const valor = t(chave, { defaultValue: "" });
  return valor || undefined;
};

/** Páginas, secções e perguntas frequentes, no idioma de `t`. */
export function entradasDoSite(t: TFunction, contexto: ContextoPesquisa): EntradaPesquisa[] {
  const entradas: EntradaPesquisa[] = [];

  for (const { chave, pt } of ROTAS) {
    const pagina = PAGINAS[chave];
    if (!pagina || !podeVer(pagina.quem, contexto)) continue;
    const inicio = chave === "inicio";
    entradas.push({
      id: `pagina:${chave}`,
      tipo: pagina.exercicio ? "exercicio" : "pagina",
      titulo: inicio ? t("Pesquisa.inicioTitulo") : t(`seo.${chave}Titulo`),
      descricao: inicio ? t("meta.descricao") : t(`seo.${chave}Descricao`),
      caminho: localizar(pt),
      palavras: opcional(t, `Pesquisa.palavras.${chave}`),
      textos: (pagina.seccoes ?? []).flatMap((s) => textosDaSeccao(t, s)),
    });
  }

  if (contexto.comSessao && contexto.papel === "admin") {
    entradas.push({
      id: "pagina:admin",
      tipo: "pagina",
      titulo: t("Navbar.painelAdmin"),
      descricao: t("Pesquisa.adminDescricao"),
      caminho: "/admin",
    });
  }

  // Destinos do menu que não são uma página inteira (têm âncora ou ?modo=).
  const doMenu = [...MENU_PRINCIPAL.flatMap((g) => g.itens ?? []), ...MENU_DOAR].filter((i) => /[#?]/.test(i.caminho));
  for (const item of doMenu) {
    entradas.push({
      id: `menu:${item.caminho}`,
      tipo: "seccao",
      titulo: t(item.rotulo),
      descricao: item.descricao ? t(item.descricao) : "",
      caminho: localizar(item.caminho),
      palavras: opcional(t, PALAVRAS_DO_MENU[item.caminho]),
    });
  }
  for (const s of SECCOES) {
    entradas.push({
      id: `seccao:${s.id}`,
      tipo: "seccao",
      titulo: t(s.rotulo),
      descricao: t(s.descricao),
      caminho: localizar(s.caminho),
      palavras: opcional(t, s.palavras),
    });
  }

  PERGUNTAS_FAQ.forEach(([pergunta, resposta], i) => {
    const textoResposta = limpar(t(resposta));
    entradas.push({
      id: `faq:${i}`,
      tipo: "pergunta",
      titulo: t(pergunta),
      descricao: textoResposta,
      caminho: localizar("/faq"),
    });
  });

  return entradas;
}

/** Publicações (só existem em português) e clínicas parceiras, vindas da API. */
export function entradasDaApi(
  t: TFunction,
  { publicacoes, clinicas }: { publicacoes: readonly PublicacaoPublica[]; clinicas: readonly ClinicaParceiraPublica[] },
): EntradaPesquisa[] {
  return [
    ...publicacoes.map(
      (p): EntradaPesquisa => ({
        id: `publicacao:${p.id}`,
        tipo: "publicacao",
        titulo: p.titulo,
        descricao: p.resumo,
        caminho: localizar(`/publicacoes/${p.slug}`),
        textos: [...p.corpo.split(/\n+/).filter((l) => l.trim()), ...(p.local ? [p.local] : [])],
        lang: IDIOMA_PT,
      }),
    ),
    ...clinicas.map(
      (c): EntradaPesquisa => ({
        id: `clinica:${c.id}`,
        tipo: "clinica",
        titulo: c.nome,
        descricao: t("Pesquisa.clinicaDescricao"),
        caminho: localizar("/parceiros#parceiros-clinicos"),
        palavras: opcional(t, "Pesquisa.palavras.clinicas"),
      }),
    ),
  ];
}
