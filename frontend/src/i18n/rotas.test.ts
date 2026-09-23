import i18n from "./index";
import {
  ALIASES_PT,
  ROTAS,
  ROTAS_BILINGUES,
  SITE,
  caminhoEmIngles,
  caminhoEmPortugues,
  disponivelNoIdiomaActual,
  localizar,
  metadadosSeo,
} from "./rotas";

describe("mapa de rotas PT <-> EN", () => {
  it("os pares pedidos estão mapeados", () => {
    expect(caminhoEmIngles("/politica-de-privacidade")).toBe("/en/privacy-policy");
    expect(caminhoEmIngles("/termos-de-utilizacao")).toBe("/en/terms-of-use");
    expect(caminhoEmIngles("/faq")).toBe("/en/faq");
    expect(caminhoEmIngles("/junte-se")).toBe("/en/contact");
    expect(caminhoEmIngles("/")).toBe("/en");
  });

  it("todas as rotas inglesas vivem sob /en e nenhuma portuguesa", () => {
    for (const r of ROTAS) {
      expect(r.en === "/en" || r.en.startsWith("/en/")).toBe(true);
      const pt: string = r.pt;
      expect(pt === "/en" || pt.startsWith("/en/")).toBe(false);
    }
  });

  it("não há chaves nem caminhos repetidos", () => {
    const unicos = (xs: string[]) => new Set(xs).size === xs.length;
    expect(unicos(ROTAS.map((r) => r.chave))).toBe(true);
    expect(unicos([...ROTAS.map((r) => r.pt), ...ALIASES_PT.map((a) => a.pt)])).toBe(true);
    expect(unicos(ROTAS.map((r) => r.en))).toBe(true);
  });

  it("ida e volta dá sempre a página de partida, nos dois sentidos (páginas bilingues)", () => {
    for (const r of ROTAS_BILINGUES) {
      const pt = r.pt.replace(":slug", "um-slug");
      const en = r.en.replace(":slug", "um-slug");
      expect(caminhoEmIngles(pt)).toBe(en);
      expect(caminhoEmPortugues(en)).toBe(pt);
    }
  });

  it("preserva parâmetros, query string e âncora", () => {
    expect(caminhoEmIngles("/publicacoes/campanha-gamek?foto=2#galeria")).toBe(
      "/en/publications/campanha-gamek?foto=2#galeria",
    );
    expect(caminhoEmPortugues("/en/publications/campanha-gamek?foto=2")).toBe(
      "/publicacoes/campanha-gamek?foto=2",
    );
  });

  it("aceita barra final", () => {
    expect(caminhoEmIngles("/faq/")).toBe("/en/faq");
    expect(caminhoEmPortugues("/en/faq/")).toBe("/faq");
  });

  it("os aliases portugueses levam à página inglesa da página canónica", () => {
    expect(caminhoEmIngles("/auth")).toBe("/en/sign-in");
    expect(caminhoEmIngles("/registo")).toBe("/en/sign-in");
    expect(caminhoEmIngles("/update-password")).toBe("/en/reset-password");
    expect(caminhoEmPortugues("/en/sign-in")).toBe("/login");
  });

  it("páginas fora do mapa levam à página inicial do outro idioma, nunca a um 404", () => {
    expect(caminhoEmIngles("/admin/utilizadores")).toBe("/en");
    expect(caminhoEmIngles("/roadmap-tecnico")).toBe("/en");
    expect(caminhoEmPortugues("/en/nao-existe")).toBe("/");
  });

  it("pedir o idioma em que já se está devolve o mesmo sítio", () => {
    expect(caminhoEmPortugues("/faq")).toBe("/faq");
    expect(caminhoEmIngles("/en/faq")).toBe("/en/faq");
  });
});

describe("localizar (links internos escritos em português)", () => {
  afterEach(() => void i18n.changeLanguage("pt-AO"));

  it("em português devolve o caminho tal como está", () => {
    void i18n.changeLanguage("pt-AO");
    expect(localizar("/faq")).toBe("/faq");
    expect(localizar("/publicacoes/um-slug?x=1#topo")).toBe("/publicacoes/um-slug?x=1#topo");
  });

  it("em inglês devolve o equivalente /en/...", () => {
    void i18n.changeLanguage("en-US");
    expect(localizar("/faq")).toBe("/en/faq");
    expect(localizar("/junte-se")).toBe("/en/contact");
    expect(localizar("/#sobre")).toBe("/en#sobre");
    expect(localizar("/publicacoes/um-slug?x=1")).toBe("/en/publications/um-slug?x=1");
  });

  it("em inglês, páginas fora do mapa (admin) ficam como estão -- não vão parar à página inicial", () => {
    void i18n.changeLanguage("en-US");
    expect(localizar("/admin/utilizadores")).toBe("/admin/utilizadores");
  });

  it("um caminho que já é inglês não é traduzido outra vez", () => {
    void i18n.changeLanguage("en-US");
    expect(localizar("/en/faq")).toBe("/en/faq");
  });
});

describe("páginas só em português (o jogo)", () => {
  afterEach(() => void i18n.changeLanguage("pt-AO"));

  it("não têm versão inglesa: o botão EN leva à página inicial inglesa", () => {
    expect(caminhoEmIngles("/jogo-curiosidades")).toBe("/en");
    expect(caminhoEmIngles("/jogo-curiosidades/jogar")).toBe("/en");
    expect(ROTAS_BILINGUES.some((r) => r.pt.startsWith("/jogo-curiosidades"))).toBe(false);
  });

  it("um URL /en/trivia-game não corresponde a nenhuma página", () => {
    expect(caminhoEmPortugues("/en/trivia-game")).toBe("/");
  });

  it("localizar() mantém o caminho PT delas, para o link poder ser reconhecido e escondido", () => {
    void i18n.changeLanguage("en-US");
    expect(localizar("/jogo-curiosidades")).toBe("/jogo-curiosidades");
    expect(disponivelNoIdiomaActual(localizar("/jogo-curiosidades"))).toBe(false);
  });

  it("os links para elas escondem-se só no site inglês", () => {
    void i18n.changeLanguage("pt-AO");
    expect(disponivelNoIdiomaActual("/jogo-curiosidades")).toBe(true);
    void i18n.changeLanguage("en-US");
    expect(disponivelNoIdiomaActual("/jogo-curiosidades")).toBe(false);
    expect(disponivelNoIdiomaActual("/jogo-curiosidades/perfil")).toBe(false);
    expect(disponivelNoIdiomaActual("/faq")).toBe(true);
    expect(disponivelNoIdiomaActual("https://www.exemplo.com/noticia")).toBe(true);
  });
});

describe("metadadosSeo (canonical + hreflang)", () => {
  const exemplo = (p: string) => p.replace(":slug", "um-slug");

  it("hreflang recíproco em todas as páginas com par: a página PT e a EN declaram o mesmo conjunto", () => {
    for (const r of ROTAS_BILINGUES) {
      const pt = metadadosSeo(exemplo(r.pt), true);
      const en = metadadosSeo(exemplo(r.en), true);
      expect(pt.alternativas).toEqual(en.alternativas);
      expect(pt.alternativas).toEqual([
        { hreflang: "pt-AO", href: SITE + exemplo(r.pt) },
        { hreflang: "en-US", href: SITE + exemplo(r.en) },
        { hreflang: "x-default", href: SITE + exemplo(r.pt) },
      ]);
      // cada página aponta para si própria como canónica
      expect(pt.canonical).toBe(SITE + exemplo(r.pt));
      expect(en.canonical).toBe(SITE + exemplo(r.en));
    }
  });

  it("URLs sempre absolutos no domínio de produção", () => {
    const { canonical, alternativas } = metadadosSeo("/faq", true);
    for (const href of [canonical, ...alternativas.map((a) => a.href)]) expect(href).toMatch(/^https:\/\/www\.janelasparaalma\.com\//);
  });

  it("páginas só em português não levam hreflang para inglês", () => {
    expect(metadadosSeo("/jogo-curiosidades", true)).toEqual({ canonical: SITE + "/jogo-curiosidades", alternativas: [] });
  });

  it("com a versão inglesa desligada, não há hreflang (as páginas /en dariam 404)", () => {
    expect(metadadosSeo("/faq", false)).toEqual({ canonical: SITE + "/faq", alternativas: [] });
  });

  it("aliases apontam para o URL canónico da página", () => {
    expect(metadadosSeo("/auth", true).canonical).toBe(SITE + "/login");
    expect(metadadosSeo("/registo", false).canonical).toBe(SITE + "/login");
  });

  it("páginas fora do mapa (admin, 404) não têm canonical nem hreflang", () => {
    expect(metadadosSeo("/admin/utilizadores", true)).toEqual({ canonical: null, alternativas: [] });
    expect(metadadosSeo("/nao-existe", true)).toEqual({ canonical: null, alternativas: [] });
    expect(metadadosSeo("/en/trivia-game", true)).toEqual({ canonical: null, alternativas: [] });
  });
});
