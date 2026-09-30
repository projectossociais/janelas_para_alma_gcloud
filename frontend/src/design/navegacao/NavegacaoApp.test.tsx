import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { Home } from "lucide-react";
import { NavegacaoApp } from "./NavegacaoApp";
import { violacoesAcessibilidade } from "../testes/acessibilidade";

const DESTINOS = [
  { rotulo: "Hoje", href: "/hoje", icone: <Home />, activo: true },
  { rotulo: "Treinos", href: "/treinos", icone: <Home /> },
  { rotulo: "Jogo", href: "/jogo", icone: <Home /> },
];

describe("NavegacaoApp", () => {
  it("cada destino tem ícone e nome; o actual marca aria-current", () => {
    render(<NavegacaoApp destinos={DESTINOS} rotulo="Navegação da app" />);
    // Uma só navegação (muda de forma com o ecrã), sem ligações duplicadas.
    const nav = screen.getByRole("navigation", { name: "Navegação da app" });
    expect(within(nav).getByRole("link", { name: "Hoje" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Treinos" })).not.toHaveAttribute("aria-current");
    expect(within(nav).getAllByRole("link")).toHaveLength(3);
  });

  it("os ícones são decorativos: o nome vem do texto", () => {
    const { container } = render(<NavegacaoApp destinos={DESTINOS} rotulo="Navegação da app" />);
    container.querySelectorAll("svg").forEach((svg) => expect(svg.closest("[aria-hidden='true']")).not.toBeNull());
  });

  it("sem violações de acessibilidade", async () => {
    const { container } = render(<NavegacaoApp destinos={DESTINOS} rotulo="Navegação da app" />);
    expect(await violacoesAcessibilidade(container)).toEqual([]);
  });
});
