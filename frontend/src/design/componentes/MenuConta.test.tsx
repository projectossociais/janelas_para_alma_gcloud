import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuConta } from "./MenuConta";
import { violacoesAcessibilidade } from "../testes/acessibilidade";

const ITENS = [
  { rotulo: "Editar perfil", href: "/editar-perfil" },
  { rotulo: "Configurações", href: "/configuracoes" },
];

const montar = (aoSair = vi.fn(), avatarUrl: string | null = null) =>
  render(
    <MenuConta nome="Ana Silva" avatarUrl={avatarUrl} rotulo="Conta de Ana Silva" itens={ITENS} sair={{ rotulo: "Sair", aoSair }} />,
  );

describe("MenuConta", () => {
  it("o botão diz de quem é a conta; sem foto mostra as iniciais", () => {
    montar();
    const botao = screen.getByRole("button", { name: "Conta de Ana Silva" });
    expect(botao).toHaveTextContent("AS");
  });

  it("com foto, mostra a foto (decorativa: o nome já está no botão)", () => {
    montar(vi.fn(), "https://exemplo.test/ana.jpg");
    const botao = screen.getByRole("button", { name: "Conta de Ana Silva" });
    expect(botao.querySelector("img")).toHaveAttribute("src", "https://exemplo.test/ana.jpg");
    expect(botao.querySelector("img")).toHaveAttribute("alt", "");
  });

  it("abre com o teclado e mostra perfil, definições e sair", async () => {
    const u = userEvent.setup();
    montar();
    screen.getByRole("button", { name: "Conta de Ana Silva" }).focus();
    await u.keyboard("{Enter}");
    expect(await screen.findByRole("menuitem", { name: "Editar perfil" })).toHaveAttribute("href", "/editar-perfil");
    expect(screen.getByRole("menuitem", { name: "Configurações" })).toHaveAttribute("href", "/configuracoes");
    expect(screen.getByRole("menuitem", { name: "Sair" })).toBeInTheDocument();
  });

  it("sair chama a acção, e só ao escolher esse item", async () => {
    const aoSair = vi.fn();
    const u = userEvent.setup();
    montar(aoSair);
    await u.click(screen.getByRole("button", { name: "Conta de Ana Silva" }));
    expect(aoSair).not.toHaveBeenCalled();
    await u.click(await screen.findByRole("menuitem", { name: "Sair" }));
    expect(aoSair).toHaveBeenCalledTimes(1);
  });

  it("Esc fecha o menu e o foco volta ao botão", async () => {
    const u = userEvent.setup();
    montar();
    const botao = screen.getByRole("button", { name: "Conta de Ana Silva" });
    await u.click(botao);
    await screen.findByRole("menu");
    await u.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(botao).toHaveFocus();
  });

  it("sem violações de acessibilidade, fechado e aberto", async () => {
    const u = userEvent.setup();
    const { container } = montar();
    expect(await violacoesAcessibilidade(container)).toEqual([]);
    await u.click(screen.getByRole("button", { name: "Conta de Ana Silva" }));
    await screen.findByRole("menu");
    expect(await violacoesAcessibilidade(document.body)).toEqual([]);
  });
});
