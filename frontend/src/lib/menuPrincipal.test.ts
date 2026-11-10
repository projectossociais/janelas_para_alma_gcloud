import ptAO from "@/i18n/locales/pt-AO.json";
import { chaveDaRota } from "@/i18n/rotas";
import { MENU_DOAR, MENU_PRINCIPAL } from "./menuPrincipal";

type Arvore = { [k: string]: string | Arvore };
const existe = (chave: string) =>
  chave.split(".").reduce<string | Arvore | undefined>((no, parte) => (typeof no === "object" ? no[parte] : undefined), ptAO as Arvore) !==
  undefined;

const todosOsItens = [...MENU_PRINCIPAL.flatMap((g) => g.itens ?? []), ...MENU_DOAR];
const todosOsCaminhos = [
  ...MENU_PRINCIPAL.filter((g) => g.caminho).map((g) => g.caminho!),
  ...todosOsItens.map((i) => i.caminho),
];

describe("menu principal do cabeçalho", () => {
  it("todo o destino é uma página do mapa de rotas (nenhum link para um 404)", () => {
    const partidos = todosOsCaminhos.filter((c) => chaveDaRota(new URL(c, "http://x").pathname) === null);
    expect(partidos).toEqual([]);
  });

  it("todo o rótulo e descrição tem texto em pt-AO", () => {
    const chaves = [
      ...MENU_PRINCIPAL.map((g) => g.rotulo),
      ...todosOsItens.flatMap((i) => [i.rotulo, ...(i.descricao ? [i.descricao] : [])]),
    ];
    expect(chaves.filter((k) => !existe(k))).toEqual([]);
  });

  it("um grupo é um menu suspenso ou um link directo, nunca as duas coisas", () => {
    expect(MENU_PRINCIPAL.filter((g) => Boolean(g.itens) === Boolean(g.caminho))).toEqual([]);
  });

  it("o botão Doar Agora leva à doação única e à mensal", () => {
    expect(MENU_DOAR.map((i) => i.caminho)).toEqual(["/apoiar?modo=unica", "/apoiar?modo=mensal#como-apoiar"]);
  });
});
