import { describe, expect, it } from "vitest";
import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Campo } from "./Campo";
import { violacoesAcessibilidade } from "../testes/acessibilidade";

describe("Campo", () => {
  it("o rótulo nomeia o campo (encontrado pelo rótulo, como um leitor de ecrã)", () => {
    render(<Campo rotulo="Nome da criança" />);
    expect(screen.getByLabelText("Nome da criança")).toBeInstanceOf(HTMLInputElement);
  });

  it("a ajuda descreve o campo", () => {
    render(<Campo rotulo="Telefone" ajuda="9 números, começa por 9" />);
    expect(screen.getByLabelText("Telefone")).toHaveAccessibleDescription("9 números, começa por 9");
  });

  it("com erro: aria-invalid e descrição com ajuda e erro, por esta ordem", () => {
    render(<Campo rotulo="Telefone" ajuda="9 números" erro="Faltam números" />);
    const campo = screen.getByLabelText("Telefone");
    expect(campo).toHaveAttribute("aria-invalid", "true");
    expect(campo).toHaveAccessibleDescription("9 números Faltam números");
  });

  it("sem erro não marca aria-invalid", () => {
    render(<Campo rotulo="Email" />);
    expect(screen.getByLabelText("Email")).not.toHaveAttribute("aria-invalid");
  });

  it("junta um aria-describedby vindo de fora, sem o perder", () => {
    render(
      <>
        <p id="extra">Nota</p>
        <Campo rotulo="Email" ajuda="O que usa todos os dias" aria-describedby="extra" />
      </>,
    );
    expect(screen.getByLabelText("Email")).toHaveAccessibleDescription("O que usa todos os dias Nota");
  });

  it("passa os atributos do teclado do telemóvel e aceita escrita", async () => {
    render(<Campo rotulo="Telefone" type="tel" inputMode="numeric" autoComplete="tel-national" />);
    const campo = screen.getByLabelText("Telefone");
    expect(campo).toHaveAttribute("type", "tel");
    expect(campo).toHaveAttribute("inputmode", "numeric");
    expect(campo).toHaveAttribute("autocomplete", "tel-national");
    await userEvent.type(campo, "923456789");
    expect(campo).toHaveValue("923456789");
  });

  it("encaminha a ref para o <input> (para dar foco ao primeiro erro)", () => {
    const ref = createRef<HTMLInputElement>();
    render(<Campo rotulo="Nome" ref={ref} />);
    expect(ref.current).toBe(screen.getByLabelText("Nome"));
  });

  it("dois campos sem id não partilham ids", () => {
    render(
      <>
        <Campo rotulo="A" ajuda="a" />
        <Campo rotulo="B" ajuda="b" />
      </>,
    );
    expect(screen.getByLabelText("A").id).not.toBe(screen.getByLabelText("B").id);
    expect(screen.getByLabelText("B")).toHaveAccessibleDescription("b");
  });

  it("sem violações de acessibilidade (normal, com ajuda, com erro, desactivado)", async () => {
    const { container } = render(
      <form>
        <Campo rotulo="Nome" />
        <Campo rotulo="Telefone" ajuda="9 números" type="tel" />
        <Campo rotulo="Email" erro="Falta o @" type="email" />
        <Campo rotulo="Província" disabled />
      </form>,
    );
    expect(await violacoesAcessibilidade(container)).toEqual([]);
  });
});
