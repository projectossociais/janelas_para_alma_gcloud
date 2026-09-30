import { describe, expect, it } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OpcaoConfirmar } from "./OpcaoConfirmar";
import { violacoesAcessibilidade } from "../testes/acessibilidade";

const Controlada = ({ descricao }: { descricao?: string }) => {
  const [m, setM] = useState(false);
  return <OpcaoConfirmar rotulo="Luz de frente" descricao={descricao} marcada={m} aoMudar={setM} />;
};

describe("OpcaoConfirmar", () => {
  it("é uma caixa de selecção com o rótulo como nome", () => {
    render(<Controlada />);
    expect(screen.getByRole("checkbox", { name: "Luz de frente" })).not.toBeChecked();
  });

  it("tocar em qualquer parte da linha marca e desmarca", async () => {
    render(<Controlada />);
    await userEvent.click(screen.getByText("Luz de frente"));
    expect(screen.getByRole("checkbox")).toBeChecked();
    await userEvent.click(screen.getByText("Luz de frente"));
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("o teclado funciona (Tab e Espaço)", async () => {
    render(<Controlada />);
    await userEvent.tab();
    expect(screen.getByRole("checkbox")).toHaveFocus();
    await userEvent.keyboard(" ");
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("a descrição descreve a caixa", () => {
    render(<Controlada descricao="Sem janela atrás de si" />);
    expect(screen.getByRole("checkbox")).toHaveAccessibleDescription("Sem janela atrás de si");
  });

  it("sem violações de acessibilidade", async () => {
    const { container } = render(<Controlada descricao="Sem janela atrás de si" />);
    expect(await violacoesAcessibilidade(container)).toEqual([]);
  });
});
