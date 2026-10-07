import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Cartao, CartaoLigacao, CartaoTexto, CartaoTitulo } from "./Cartao";
import { violacoesAcessibilidade } from "../testes/acessibilidade";

describe("Cartao", () => {
  it("cartão interactivo: a ligação tem só o nome do título, não o cartão inteiro", () => {
    render(
      <Cartao interactivo>
        <CartaoTitulo>
          <CartaoLigacao href="/exercicios/aneis">Treino de Anéis</CartaoLigacao>
        </CartaoTitulo>
        <CartaoTexto>6 minutos, um olho de cada vez.</CartaoTexto>
      </Cartao>,
    );
    const ligacao = screen.getByRole("link", { name: "Treino de Anéis" });
    expect(ligacao).toHaveAttribute("href", "/exercicios/aneis");
    expect(screen.getByRole("heading", { level: 3, name: "Treino de Anéis" })).toBeInTheDocument();
  });

  it("o nível do título é escolhido por quem usa, para a hierarquia da página", () => {
    render(
      <Cartao>
        <CartaoTitulo como="h2">Resultado</CartaoTitulo>
      </Cartao>,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Resultado" })).toBeInTheDocument();
  });

  it("asChild na ligação usa o elemento de quem chama (ex.: o Link do router)", () => {
    render(
      <CartaoLigacao asChild>
        <a href="/x" data-router="sim">
          Ir
        </a>
      </CartaoLigacao>,
    );
    expect(screen.getByRole("link", { name: "Ir" })).toHaveAttribute("data-router", "sim");
  });

  it("sem violações de acessibilidade", async () => {
    const { container } = render(
      <div>
        <Cartao>
          <CartaoTitulo>Simples</CartaoTitulo>
          <CartaoTexto>Texto</CartaoTexto>
        </Cartao>
        <Cartao interactivo>
          <CartaoTitulo>
            <CartaoLigacao href="/y">Interactivo</CartaoLigacao>
          </CartaoTitulo>
        </Cartao>
      </div>,
    );
    expect(await violacoesAcessibilidade(container)).toEqual([]);
  });
});
