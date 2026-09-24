import ptAO from "./locales/pt-AO.json";
import enUS from "./locales/en-US.json";
import revisao from "./revisao.json";

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

describe("tradução en-US (Fase 3)", () => {
  it("nenhum valor de en-US.json está vazio", () => {
    const vazios = [...en].filter(([, v]) => v.trim() === "").map(([k]) => k);
    expect(vazios).toEqual([]);
  });

  it("todas as chaves de revisao.json existem no dicionário, com uma categoria válida", () => {
    const invalidas = Object.entries(revisao as Record<string, string>)
      .filter(([k, cat]) => !pt.has(k) || !en.has(k) || !["health", "legal", "duvida"].includes(cat))
      .map(([k]) => k);
    expect(invalidas).toEqual([]);
  });

  /**
   * Alerta de português esquecido no inglês. Nomes próprios que ficam em
   * português (marca, programa, moradas, títulos de obras citadas) são
   * retirados antes de procurar; tudo o resto com acentuação portuguesa ou
   * palavras portuguesas comuns faz o teste falhar. Para um caso novo e
   * legítimo, acrescentá-lo a EXCEPCOES_PT (e ao glossário).
   */
  const EXCEPCOES_PT = [
    /Janelas\s*(<br\/>)?\s*para a Alma/gi,
    /Meu Kamba Estrábico/gi,
    /[\w.+-]+@[\w-]+\.[\w.]+/g, // endereços de email
    /Visão da Banda!?/g,
    /Kássia Nunda|Dalva Etelvina Benguela Filipe/g,
    /Urbanização Nova Vida, Rua 54( \(rua do tribunal provincial\))?, Centro Empresarial Living-Luanda(, Lote 9, Luanda, Angola\.)?/g,
    /Rua do assalto ao quartel da Moncada/g,
    /Benfica \/ Zona Verde \/ Condomínio Villa Israel/g,
    /Clínica Sagrada Esperança|Centro Óptico Angolano|Clínica Multiperfil|Ilha de Luanda/g,
    /Palco Universitário|Estudante Blindado|ASG Conexão Mulheres/g,
    /Agência de Protecção de Dados/g,
    /Olhar Alinhado - Comércio & Prestação de Serviços, Lda\./g,
    /"Estrabismos: da teoria à prática, dos conceitos às suas operacionalizações"\. Arquivos Brasileiros de Oftalmologia/g,
    /"Estrabismo para Totós"\. Sociedade Portuguesa de Oftalmologia/g,
    /"Breves Considerações sobre o Estrabismo", Repositório Aberto da Universidade do Porto/g,
    /PT: versão do site em português/g, // o link para a versão portuguesa é, de propósito, em português
    /Tio Zé|Mana Fefa|Dona Maria|Kota Beto/g, // vendedores do Mercado do jogo (nomes próprios)
  ];
  const PALAVRAS_PT = /[ãõçáàâéêíóôú]|\b(de|da|das|dos|para|que|não|com|uma|também|está|são|pelo|pela|nosso|nossa|ou|mais|muito|sem|onde|quando|seu|sua)\b/i;

  it("nenhum valor inglês contém acentuação portuguesa ou palavras portuguesas (fora das excepções)", () => {
    const suspeitos = [...en]
      .filter(([k]) => !k.startsWith("idioma."))
      .map(([k, v]) => [k, EXCEPCOES_PT.reduce((s, re) => s.replace(re, ""), v)] as const)
      .filter(([, v]) => PALAVRAS_PT.test(v))
      .map(([k, v]) => `${k}: ${v.slice(0, 80)}`);
    expect(suspeitos).toEqual([]);
  });
});
