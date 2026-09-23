import { ALIASES_PT, ROTAS, caminhoEmIngles, caminhoEmPortugues } from "./rotas";

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

  it("ida e volta dá sempre a página de partida, nos dois sentidos", () => {
    for (const r of ROTAS) {
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
