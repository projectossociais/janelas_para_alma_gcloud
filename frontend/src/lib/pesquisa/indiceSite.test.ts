import { describe, it, expect, afterEach } from "vitest";
import i18n from "@/i18n";
import ptAO from "@/i18n/locales/pt-AO.json";
import { IDIOMA_EN, IDIOMA_PT } from "@/i18n/idiomas";
import { ROTAS, chaveDaRota } from "@/i18n/rotas";
import { FORA_DA_PESQUISA, PAGINAS, PERGUNTAS_FAQ, SECCOES, SUGESTOES, entradasDaApi, entradasDoSite } from "./indiceSite";
import { prepararIndice, procurar } from "./procurar";

type Arvore = { [k: string]: string | Arvore };
const noDicionario = (chave: string) =>
  chave.split(".").reduce<string | Arvore | undefined>((no, p) => (typeof no === "object" ? no[p] : undefined), ptAO as Arvore);

const visitante = { comSessao: false, papel: null };
const t = i18n.t.bind(i18n);
const procurarNoSite = (consulta: string, contexto = visitante) =>
  procurar(prepararIndice(entradasDoSite(t, contexto)), consulta).map((r) => r.entrada.id);

afterEach(async () => {
  await i18n.changeLanguage(IDIOMA_PT);
});

describe("índice da pesquisa do site", () => {
  it("toda a página do mapa de rotas está na pesquisa ou foi deixada de fora de propósito", () => {
    const porDecidir = ROTAS.map((r) => r.chave).filter((c) => !PAGINAS[c] && !FORA_DA_PESQUISA.includes(c));
    expect(porDecidir).toEqual([]);
  });

  it("nenhuma página está nas duas listas", () => {
    expect(FORA_DA_PESQUISA.filter((c) => PAGINAS[c])).toEqual([]);
  });

  it("o rastreio completo (só para voluntários) nunca aparece", () => {
    const todas = entradasDoSite(t, { comSessao: true, papel: "admin" });
    expect(todas.filter((e) => e.caminho.includes("rastreio-completo"))).toEqual([]);
    expect(procurarNoSite("rastreio completo")).not.toContain("pagina:rastreioCompleto");
  });

  it("toda a entrada tem título e leva a uma página que existe", () => {
    const todas = entradasDoSite(t, { comSessao: true, papel: "profissional" });
    expect(todas.filter((e) => !e.titulo.trim())).toEqual([]);
    expect(todas.filter((e) => chaveDaRota(new URL(e.caminho, "http://x").pathname) === null).map((e) => e.id)).toEqual([]);
    expect(new Set(todas.map((e) => e.id)).size).toBe(todas.length);
  });

  it("as secções de texto, as perguntas e as secções com âncora existem nas traduções", () => {
    const chaves = [
      ...Object.values(PAGINAS).flatMap((p) => p?.seccoes ?? []),
      ...PERGUNTAS_FAQ.flat(),
      ...SECCOES.flatMap((s) => [s.rotulo, s.descricao, ...(s.palavras ? [s.palavras] : [])]),
    ];
    expect(chaves.filter((c) => noDicionario(c) === undefined)).toEqual([]);
  });

  it("as palavras-chave são de páginas que existem", () => {
    const conhecidas = new Set<string>([...ROTAS.map((r) => r.chave), "voluntariado", "clinicas", "contacto", "jornada"]);
    const palavras = Object.keys((ptAO as unknown as { Pesquisa: { palavras: Record<string, string> } }).Pesquisa.palavras);
    expect(palavras.filter((p) => !conhecidas.has(p))).toEqual([]);
  });

  it("as sugestões existem para um visitante", () => {
    const idsDoSite = new Set(entradasDoSite(t, visitante).map((e) => e.id));
    expect(SUGESTOES.filter((id) => !idsDoSite.has(id))).toEqual([]);
  });

  it("páginas de conta só aparecem a quem as pode abrir", () => {
    expect(procurarNoSite("configurações")).not.toContain("pagina:configuracoes");
    expect(procurarNoSite("configurações", { comSessao: true, papel: "estrabico" })[0]).toBe("pagina:configuracoes");

    const ids = (papel: string) => entradasDoSite(t, { comSessao: true, papel }).map((e) => e.id);
    expect(ids("estrabico")).toContain("pagina:dashboard");
    expect(ids("estrabico")).not.toContain("pagina:dashboardPro");
    expect(ids("profissional")).toContain("pagina:dashboardPro");
    expect(ids("profissional")).not.toContain("pagina:dashboard");
    expect(ids("admin")).toContain("pagina:admin");
    expect(ids("estrabico")).not.toContain("pagina:admin");
  });

  it.each([
    ["estrabismo", "pagina:sobre"],
    ["olho torto", "pagina:sobre"],
    ["rastreio", "pagina:scanner"],
    ["exercicios", "pagina:exercicios"],
    ["kianda", "pagina:exercicioAneis"],
    ["tapa-olho", "pagina:exercicioPertoLonge"],
    ["quanto custa o premium", "pagina:registoPremium"],
    ["doar", "pagina:apoiar"],
    ["marcar consulta", "pagina:parceiros"],
    ["optioptika", "pagina:portalClinicoOptioptika"],
    ["voluntario", "seccao:voluntariado"],
    ["contactos", "menu:/junte-se#contacto"],
    ["jogo", "pagina:jogoMenu"],
    ["privacidade", "pagina:politicaPrivacidade"],
    ["cookies", "faq:4"],
    ["apagar a minha conta", "faq:1"],
    ["criar conta", "pagina:entrar"],
    ["equipa", "pagina:equipa"],
    ["blog", "menu:/publicacoes#artigos"],
  ])("em português, \"%s\" encontra %s", (consulta, esperado) => {
    expect(procurarNoSite(consulta).slice(0, 3)).toContain(esperado);
  });

  it("encontra o que está escrito dentro das páginas, não só nos títulos", () => {
    // O IBAN só aparece no corpo das páginas de pagamento e de doação.
    const resultados = procurar(prepararIndice(entradasDoSite(t, visitante)), "oclusores");
    expect(resultados.map((r) => r.entrada.id)).toContain("pagina:apoiar");
  });

  it("em inglês procura no texto inglês e leva às páginas inglesas", async () => {
    await i18n.changeLanguage(IDIOMA_EN);
    const tEn = i18n.t.bind(i18n);
    const resultados = procurar(prepararIndice(entradasDoSite(tEn, visitante)), "lazy eye");
    expect(resultados.length).toBeGreaterThan(0);
    expect(resultados.every((r) => r.entrada.caminho.startsWith("/en"))).toBe(true);
    const [doar] = procurar(prepararIndice(entradasDoSite(tEn, visitante)), "donate");
    expect(doar.entrada.caminho.startsWith("/en/donate")).toBe(true);
  });
});

describe("publicações e clínicas da API", () => {
  const daApi = entradasDaApi(t, {
    publicacoes: [
      {
        id: "p1",
        slug: "rastreio-no-cazenga",
        titulo: "Rastreio no Cazenga",
        resumo: "Um dia de rastreios numa escola.",
        corpo: "Primeiro parágrafo.\n\nFalámos com as famílias sobre a ambliopia.",
        local: "Cazenga, Luanda",
        data_evento: null,
        capa_url: null,
        midias: [],
        visualizacoes: 0,
        gostos: 0,
        gostei: false,
      },
    ],
    clinicas: [{ id: "c1", nome: "Clínica Girassol" }],
  });
  const indice = prepararIndice(daApi);

  it("uma publicação encontra-se pelo título, pelo corpo e pelo local, e abre a sua página", () => {
    for (const consulta of ["cazenga", "ambliopia", "luanda"]) {
      expect(procurar(indice, consulta)[0].entrada.caminho).toBe("/publicacoes/rastreio-no-cazenga");
    }
    expect(procurar(indice, "ambliopia")[0].excerto).toBe("Falámos com as famílias sobre a ambliopia.");
  });

  it("uma clínica encontra-se pelo nome e leva à lista de clínicas", () => {
    const [r] = procurar(indice, "girassol");
    expect(r.entrada.tipo).toBe("clinica");
    expect(r.entrada.caminho).toBe("/parceiros#parceiros-clinicos");
  });
});
