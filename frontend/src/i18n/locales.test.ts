import ptAO from "./locales/pt-AO.json";
import enUS from "./locales/en-US.json";

type Arvore = { [chave: string]: string | Arvore };

/** Todas as chaves-folha, em notação `a.b.c`. */
function chaves(arvore: Arvore, prefixo = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(arvore)) {
    const caminho = prefixo ? `${prefixo}.${k}` : k;
    if (typeof v === "string") out.set(caminho, v);
    else for (const [ck, cv] of chaves(v, caminho)) out.set(ck, cv);
  }
  return out;
}

const pt = chaves(ptAO as Arvore);
const en = chaves(enUS as Arvore);

/** Variáveis `{{x}}` e tags do <Trans> (`<strong>`, `<link/>`...), sem ordem. */
const marcadores = (s: string) =>
  [...(s.match(/\{\{\s*[\w.]+\s*\}\}|<\/?[\w]+\s*\/?>/g) ?? [])].map((m) => m.replace(/\s/g, "")).sort();

describe("ficheiros de tradução", () => {
  it("todas as chaves de pt-AO existem em en-US", () => {
    const emFalta = [...pt.keys()].filter((k) => !en.has(k));
    expect(emFalta).toEqual([]);
  });

  it("en-US não tem chaves que não existam em pt-AO", () => {
    const aMais = [...en.keys()].filter((k) => !pt.has(k));
    expect(aMais).toEqual([]);
  });

  it("nenhum texto português está vazio", () => {
    const vazios = [...pt].filter(([, v]) => v.trim() === "").map(([k]) => k);
    expect(vazios).toEqual([]);
  });

  it("nenhuma tag do <Trans> usa o nome de um elemento vazio de HTML (excepto <br/>)", () => {
    // O parser do react-i18next trata <link>, <img>, <input>... como elementos
    // vazios: o texto lá dentro sai *fora* do componente (bug real: o link da
    // FAQ ficava vazio). Usar nomes como <ligacao>.
    const VAZIOS = /<\/?(area|base|col|embed|hr|img|input|link|meta|param|source|track|wbr)\d*\s*\/?>/;
    const maus = [...pt, ...en].filter(([, v]) => VAZIOS.test(v)).map(([k]) => k);
    expect(maus).toEqual([]);
  });

  it("uma tradução preenchida mantém as mesmas variáveis e tags do português", () => {
    const diferentes = [...en]
      .filter(([k, v]) => v !== "" && JSON.stringify(marcadores(v)) !== JSON.stringify(marcadores(pt.get(k) ?? "")))
      .map(([k]) => k);
    expect(diferentes).toEqual([]);
  });
});
