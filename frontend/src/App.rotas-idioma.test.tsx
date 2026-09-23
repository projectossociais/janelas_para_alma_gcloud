import { render, screen, waitFor, within } from "@testing-library/react";
import i18n from "@/i18n";
import App from "./App";

/**
 * Percurso completo: rota -> página -> idioma do documento -> botão de idioma.
 * A API responde sempre 401 (visitante sem sessão) -- estes testes não tocam em dados.
 */
function abrir(url: string) {
  window.history.pushState({}, "", url);
  return render(<App />);
}

function rodape() {
  return within(screen.getByRole("contentinfo"));
}

beforeEach(() => {
  // jsdom não implementa scrollTo; o ScrollToTop chama-o a cada mudança de rota.
  vi.stubGlobal("scrollTo", vi.fn());
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify({ detail: "não autenticado" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("com VITE_ENABLE_EN desligada (omissão)", () => {
  it("as rotas /en/* não existem: caem no 404", async () => {
    abrir("/en/faq");
    expect(await screen.findByRole("heading", { name: "404" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Perguntas Frequentes" })).not.toBeInTheDocument();
  });

  it("em português os links internos ficam exactamente como estavam", async () => {
    abrir("/faq");
    await screen.findByRole("heading", { name: "Perguntas Frequentes" });
    expect(rodape().getByRole("link", { name: "Política de Privacidade" })).toHaveAttribute("href", "/politica-de-privacidade");
  });

  it("o site é português e o botão EN não aparece", async () => {
    abrir("/faq");
    expect(await screen.findByRole("heading", { name: "Perguntas Frequentes" })).toBeInTheDocument();
    await waitFor(() => expect(document.documentElement.lang).toBe("pt-AO"));
    expect(rodape().queryByRole("link", { name: /^EN/ })).not.toBeInTheDocument();
  });
});

describe("com VITE_ENABLE_EN=true", () => {
  beforeEach(() => vi.stubEnv("VITE_ENABLE_EN", "true"));

  it("em português, o botão EN leva à mesma página em inglês", async () => {
    abrir("/faq");
    await screen.findByRole("heading", { name: "Perguntas Frequentes" });
    await waitFor(() => expect(document.documentElement.lang).toBe("pt-AO"));

    const en = rodape().getByRole("link", { name: /^EN/ });
    expect(en).toHaveTextContent("EN");
    expect(en).toHaveAttribute("href", "/en/faq");
    expect(en).toHaveAttribute("hreflang", "en-US");
    expect(en).toHaveAttribute("lang", "en");
  });

  it("uma rota /en/* renderiza a página em inglês e põe o documento em en-US", async () => {
    abrir("/en/privacy-policy");
    expect(await screen.findByRole("heading", { name: "Privacy Policy" })).toBeInTheDocument();
    await waitFor(() => expect(document.documentElement.lang).toBe("en-US"));
    expect(i18n.language).toBe("en-US");

    const pt = rodape().getByRole("link", { name: /^PT/ });
    expect(pt).toHaveTextContent("PT");
    expect(pt).toHaveAttribute("href", "/politica-de-privacidade");
    expect(pt).toHaveAttribute("hreflang", "pt-AO");
    expect(pt).toHaveAttribute("lang", "pt");
  });

  it("numa página inglesa, os links internos levam às rotas /en/...", async () => {
    abrir("/en/faq");
    await screen.findByRole("heading", { name: "Frequently Asked Questions" });
    expect(rodape().getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/en/privacy-policy");
    expect(rodape().getByRole("link", { name: "Terms of Use" })).toHaveAttribute("href", "/en/terms-of-use");
    expect(rodape().getByRole("link", { name: "FAQ" })).toHaveAttribute("href", "/en/faq");
  });

  it("links dentro do conteúdo (respostas da FAQ, definidas ao nível do módulo) também vão para /en/...", async () => {
    abrir("/en/faq");
    await screen.findByRole("heading", { name: "Frequently Asked Questions" });
    const links = screen.getAllByRole("link", { name: "Privacy Policy" });
    expect(links.length).toBeGreaterThan(1); // rodapé + resposta aberta por omissão
    for (const l of links) expect(l).toHaveAttribute("href", "/en/privacy-policy");
  });

  it("uma chave ainda por traduzir (vazia em en-US) mostra o português, não um espaço em branco", async () => {
    abrir("/en/faq");
    await screen.findByRole("heading", { name: "Frequently Asked Questions" });
    i18n.addResource("pt-AO", "translation", "Teste.chaveNova", "Texto novo");
    i18n.addResource("en-US", "translation", "Teste.chaveNova", "");
    expect(i18n.t("Teste.chaveNova")).toBe("Texto novo");
  });

  it("voltar a uma rota portuguesa repõe pt-AO", async () => {
    abrir("/en/faq");
    await waitFor(() => expect(document.documentElement.lang).toBe("en-US"));
    abrir("/faq");
    await waitFor(() => expect(document.documentElement.lang).toBe("pt-AO"));
    expect(i18n.language).toBe("pt-AO");
  });
});
