import { describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CabecalhoSite } from "./CabecalhoSite";
import type { Destino } from "./tipos";
import { violacoesAcessibilidade } from "../testes/acessibilidade";

const DESTINOS: Destino[] = [
  { rotulo: "Rastreio", href: "/rastreio", activo: true },
  { rotulo: "Treinos", href: "/treinos" },
  {
    rotulo: "Comunidade",
    href: "/comunidade",
    filhos: [
      { rotulo: "Actividades", descricao: "O que já fizemos e o que vem aí", href: "/comunidade/actividades" },
      { rotulo: "Ser voluntário", href: "/comunidade/voluntariado" },
    ],
  },
];

const montar = () =>
  render(
    <CabecalhoSite
      logotipo={<img src="/logo.svg" alt="" />}
      inicio={{ href: "/", rotulo: "Janelas Para a Alma, início" }}
      destinos={DESTINOS}
      accao={{ rotulo: "Fazer rastreio", href: "/rastreio/comecar" }}
      entrada={<a href="/entrar">Entrar</a>}
      textos={{ navegacao: "Navegação principal", menu: "Menu", fechar: "Fechar" }}
    />,
  );

describe("CabecalhoSite", () => {
  it("é o cabeçalho da página (banner), com a navegação principal nomeada", () => {
    montar();
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Navegação principal" })).toBeInTheDocument();
  });

  it("o logótipo leva ao início, com nome acessível", () => {
    montar();
    expect(screen.getByRole("link", { name: "Janelas Para a Alma, início" })).toHaveAttribute("href", "/");
  });

  it("marca a página actual com aria-current", () => {
    montar();
    const nav = screen.getByRole("navigation", { name: "Navegação principal" });
    expect(within(nav).getByRole("link", { name: "Rastreio" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Treinos" })).not.toHaveAttribute("aria-current");
  });

  it("'Entrar' e a acção principal estão no cabeçalho", () => {
    montar();
    expect(screen.getByRole("link", { name: "Entrar" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Fazer rastreio" })).toHaveAttribute("href", "/rastreio/comecar");
  });

  it("um destino com filhos abre com clique e mostra as subpáginas com a explicação", async () => {
    montar();
    const nav = screen.getByRole("navigation", { name: "Navegação principal" });
    await userEvent.click(within(nav).getByRole("button", { name: "Comunidade" }));
    const actividades = await within(nav).findByRole("link", { name: /Actividades/ });
    expect(actividades).toHaveAttribute("href", "/comunidade/actividades");
    expect(actividades).toHaveTextContent("O que já fizemos e o que vem aí");
  });

  it("sem violações de acessibilidade", async () => {
    const { container } = montar();
    expect(await violacoesAcessibilidade(container)).toEqual([]);
  });
});

describe("MenuMovel", () => {
  it("o botão diz 'Menu' e abre o menu em ecrã inteiro, com os grupos", async () => {
    montar();
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    const menu = await screen.findByRole("dialog", { name: "Menu" });
    expect(within(menu).getByRole("heading", { name: "Comunidade" })).toBeInTheDocument();
    expect(within(menu).getByRole("link", { name: "Ser voluntário" })).toHaveAttribute("href", "/comunidade/voluntariado");
    expect(within(menu).getByRole("link", { name: "Rastreio" })).toHaveAttribute("aria-current", "page");
    expect(within(menu).getByRole("link", { name: "Fazer rastreio" })).toBeInTheDocument();
  });

  it("escolher um destino fecha o menu", async () => {
    montar();
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    const menu = await screen.findByRole("dialog", { name: "Menu" });
    await userEvent.click(within(menu).getByRole("link", { name: "Treinos" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("Esc fecha e o foco volta ao botão 'Menu'", async () => {
    montar();
    const botao = screen.getByRole("button", { name: "Menu" });
    await userEvent.click(botao);
    await screen.findByRole("dialog");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(botao).toHaveFocus();
  });

  it("sem violações de acessibilidade com o menu aberto", async () => {
    montar();
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    await screen.findByRole("dialog");
    expect(await violacoesAcessibilidade(document.body)).toEqual([]);
  });
});
