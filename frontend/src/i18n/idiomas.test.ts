import { eRotaInglesa, idiomaDaRota, inglesAtivo } from "./idiomas";

afterEach(() => vi.unstubAllEnvs());

describe("eRotaInglesa", () => {
  it.each(["/en", "/en/", "/en/faq", "/en/publications/um-slug"])("%s é inglesa", (p) => {
    expect(eRotaInglesa(p)).toBe(true);
  });

  it.each(["/", "/faq", "/english", "/enviar", "/entrar", "/pt/en"])("%s não é inglesa", (p) => {
    expect(eRotaInglesa(p)).toBe(false);
  });
});

describe("idiomaDaRota", () => {
  it("com a versão inglesa activa, /en/* é en-US e o resto pt-AO", () => {
    expect(idiomaDaRota("/en/faq", true)).toBe("en-US");
    expect(idiomaDaRota("/faq", true)).toBe("pt-AO");
  });

  it("com a versão inglesa desligada, tudo é pt-AO -- incluindo /en/*", () => {
    expect(idiomaDaRota("/en/faq", false)).toBe("pt-AO");
  });
});

describe("inglesAtivo", () => {
  it("está desligada por omissão", () => {
    vi.stubEnv("VITE_ENABLE_EN", "");
    expect(inglesAtivo()).toBe(false);
  });

  it("só liga com o valor exacto 'true'", () => {
    vi.stubEnv("VITE_ENABLE_EN", "1");
    expect(inglesAtivo()).toBe(false);
    vi.stubEnv("VITE_ENABLE_EN", "true");
    expect(inglesAtivo()).toBe(true);
  });
});
