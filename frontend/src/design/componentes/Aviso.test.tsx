import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Aviso } from "./Aviso";
import { violacoesAcessibilidade } from "../testes/acessibilidade";

describe("Aviso", () => {
  it("mostra título, texto e acção", () => {
    render(
      <Aviso titulo="Isto não é um diagnóstico" accao={<button type="button">Saber mais</button>}>
        Só um médico pode confirmar.
      </Aviso>,
    );
    expect(screen.getByText("Isto não é um diagnóstico")).toBeInTheDocument();
    expect(screen.getByText("Só um médico pode confirmar.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Saber mais" })).toBeInTheDocument();
  });

  it("não se anuncia por omissão (já estava na página)", () => {
    render(<Aviso variante="erro">Erro</Aviso>);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("anunciar: erros são 'alert' (de imediato), os outros 'status' (educado)", () => {
    const { rerender } = render(
      <Aviso variante="erro" anunciar>
        Não foi possível enviar.
      </Aviso>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível enviar.");
    rerender(
      <Aviso variante="sucesso" anunciar>
        Guardado.
      </Aviso>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Guardado.");
  });

  it("o ícone é decorativo: o significado está no texto", () => {
    const { container } = render(<Aviso variante="aviso">Cuidado</Aviso>);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("sem violações de acessibilidade nas quatro variantes", async () => {
    const { container } = render(
      <div>
        <Aviso variante="info" titulo="Info">Texto</Aviso>
        <Aviso variante="sucesso" titulo="Sucesso" anunciar>Texto</Aviso>
        <Aviso variante="aviso">Texto</Aviso>
        <Aviso variante="erro" titulo="Erro" anunciar>Texto</Aviso>
      </div>,
    );
    expect(await violacoesAcessibilidade(container)).toEqual([]);
  });
});
