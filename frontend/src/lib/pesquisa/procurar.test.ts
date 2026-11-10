import { describe, it, expect } from "vitest";
import { normalizar, prepararIndice, procurar, realcar, termosDaConsulta, type EntradaPesquisa } from "./procurar";

const entrada = (id: string, extra: Partial<EntradaPesquisa>): EntradaPesquisa => ({
  id,
  tipo: "pagina",
  titulo: id,
  descricao: "",
  caminho: `/${id}`,
  ...extra,
});

const INDICE = prepararIndice([
  entrada("sobre", {
    titulo: "O que é o Estrabismo?",
    descricao: "O que o causa e como se trata.",
    palavras: "olho torto, vesgo, ambliopia",
  }),
  entrada("apoiar", {
    titulo: "Apoiar a Causa",
    descricao: "Faça a diferença com uma doação.",
    palavras: "doar, doação, iban",
    textos: ["Envie o comprovativo da transferência depois de pagar.", "Entregamos óculos a crianças de Luanda."],
  }),
  entrada("faq-cookies", {
    tipo: "pergunta",
    titulo: "O site utiliza cookies?",
    descricao: "Utilizamos apenas cookies técnicos essenciais.",
  }),
  entrada("exercicios", { titulo: "Testes e treinos visuais", descricao: "Treinos de apoio para a visão, sem câmara." }),
  entrada("publicacao", {
    tipo: "publicacao",
    titulo: "Rastreio na escola do Cazenga",
    descricao: "Um dia de rastreios.",
    textos: [
      "Passámos a manhã com os alunos e os professores da escola, e à tarde falámos com as famílias sobre o estrabismo e sobre o que fazer quando uma criança entorta um olho ao ler.",
    ],
  }),
]);

const ids = (consulta: string) => procurar(INDICE, consulta).map((r) => r.entrada.id);

describe("normalizar", () => {
  it("tira acentos e maiúsculas sem mudar o comprimento", () => {
    expect(normalizar("Óculos À Mão")).toBe("oculos a mao");
    expect(normalizar("Doação").length).toBe("Doação".length);
  });
});

describe("termosDaConsulta", () => {
  it("ignora as palavras de ligação", () => {
    expect(termosDaConsulta("o que é o estrabismo")).toEqual(["estrabismo"]);
  });

  it("fica com as palavras de ligação quando não há mais nada", () => {
    expect(termosDaConsulta("o que")).toEqual(["o", "que"]);
  });
});

describe("procurar", () => {
  it("consulta vazia não devolve nada", () => {
    expect(procurar(INDICE, "   ")).toEqual([]);
  });

  it("encontra sem acentos e sem maiúsculas", () => {
    expect(ids("DOACAO")).toEqual(["apoiar"]);
    expect(ids("oculos")).toEqual(["apoiar"]);
  });

  it("basta o início da palavra", () => {
    expect(ids("estrab")[0]).toBe("sobre");
  });

  it("o plural não atrapalha", () => {
    expect(ids("doações")).toEqual(["apoiar"]);
    expect(ids("cookie")).toEqual(["faq-cookies"]);
  });

  it("procura nas palavras-chave que não estão à vista", () => {
    expect(ids("vesgo")).toEqual(["sobre"]);
    expect(ids("iban")).toEqual(["apoiar"]);
  });

  it("procura no texto corrido da página e mostra a frase onde encontrou", () => {
    const [r] = procurar(INDICE, "comprovativo");
    expect(r.entrada.id).toBe("apoiar");
    expect(r.excerto).toBe("Envie o comprovativo da transferência depois de pagar.");
  });

  it("corta um excerto comprido à volta da palavra, sem a perder", () => {
    const [r] = procurar(INDICE, "famílias");
    expect(r.entrada.id).toBe("publicacao");
    expect(r.excerto!.length).toBeLessThan(140);
    expect(r.excerto).toContain("famílias");
    expect(r.excerto!.startsWith("… ")).toBe(true);
  });

  it("não mostra excerto quando a palavra já está no título ou na descrição", () => {
    expect(procurar(INDICE, "estrabismo")[0].excerto).toBeUndefined();
  });

  it("exige todas as palavras na mesma entrada", () => {
    expect(ids("cookies estrabismo")).toEqual([]);
    expect(ids("apoiar causa")).toEqual(["apoiar"]);
  });

  it("o título vale mais do que o texto corrido, e o que só roça a consulta não aparece", () => {
    // "estrabismo" está no título de `sobre` e só no corpo da publicação.
    expect(ids("estrabismo")).toEqual(["sobre"]);
    expect(ids("escola")).toEqual(["publicacao"]);
  });

  it("a palavra inteira vale mais do que o início de outra", () => {
    const indice = prepararIndice([
      entrada("contactos", { titulo: "Contactos" }),
      entrada("entrar", { titulo: "Entrar", palavras: "criar conta, conta" }),
    ]);
    expect(procurar(indice, "conta").map((r) => r.entrada.id)).toEqual(["entrar", "contactos"]);
  });

  it("tolera um erro de uma letra", () => {
    expect(ids("estrabizmo")).toEqual(["sobre"]);
    expect(ids("coockies")).toEqual(["faq-cookies"]);
  });

  it("não inventa resultados para o que não existe", () => {
    expect(ids("xyzabc")).toEqual([]);
  });

  it("respeita o limite", () => {
    expect(procurar(INDICE, "a", 2).length).toBeLessThanOrEqual(2);
  });
});

describe("realcar", () => {
  it("marca a palavra encontrada, com os acentos do original", () => {
    expect(realcar("Faça uma Doação hoje", "doacao")).toEqual([
      { texto: "Faça uma ", forte: false },
      { texto: "Doação", forte: true },
      { texto: " hoje", forte: false },
    ]);
  });

  it("marca só o início que foi escrito", () => {
    expect(realcar("Estrabismo", "estrab")).toEqual([
      { texto: "Estrab", forte: true },
      { texto: "ismo", forte: false },
    ]);
  });

  it("sem consulta devolve o texto inteiro", () => {
    expect(realcar("Olá", "")).toEqual([{ texto: "Olá", forte: false }]);
  });
});
