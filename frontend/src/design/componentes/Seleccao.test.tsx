import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Seleccao } from "./Seleccao";
import { violacoesAcessibilidade } from "../testes/acessibilidade";

const OPCOES = [
  { valor: "luanda", rotulo: "Luanda" },
  { valor: "huambo", rotulo: "Huambo" },
];

describe("Seleccao", () => {
  it("o rótulo dá o nome ao seletor e o marcador não se pode escolher de volta", () => {
    render(<Seleccao rotulo="Província" marcador="Escolha a província" opcoes={OPCOES} value="" onChange={() => {}} />);
    const seletor = screen.getByLabelText("Província");
    expect(seletor).toHaveValue("");
    expect(screen.getByRole("option", { name: "Escolha a província" })).toBeDisabled();
  });

  it("escolher uma opção avisa quem usa o componente", async () => {
    const aoMudar = vi.fn();
    render(<Seleccao rotulo="Província" marcador="Escolha" opcoes={OPCOES} defaultValue="" onChange={(e) => aoMudar(e.target.value)} />);
    await userEvent.setup().selectOptions(screen.getByLabelText("Província"), "huambo");
    expect(aoMudar).toHaveBeenCalledWith("huambo");
  });

  it("o erro e a ajuda ficam ligados ao seletor, com texto (nunca só a cor)", () => {
    render(
      <Seleccao
        rotulo="Província"
        marcador="Escolha"
        opcoes={OPCOES}
        value=""
        onChange={() => {}}
        ajuda="Onde vive."
        erro="Escolha a sua província."
      />,
    );
    const seletor = screen.getByLabelText("Província");
    expect(seletor).toHaveAttribute("aria-invalid", "true");
    expect(seletor).toHaveAccessibleDescription("Onde vive. Escolha a sua província.");
  });

  it("sem violações de acessibilidade, com e sem erro", async () => {
    const { container } = render(
      <>
        <Seleccao rotulo="Província" marcador="Escolha" opcoes={OPCOES} value="" onChange={() => {}} />
        <Seleccao rotulo="Outra" marcador="Escolha" opcoes={OPCOES} value="" onChange={() => {}} erro="Escolha uma." />
      </>,
    );
    expect(await violacoesAcessibilidade(container)).toEqual([]);
  });
});
