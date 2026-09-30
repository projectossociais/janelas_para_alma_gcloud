import { describe, expect, it } from "vitest";
import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProvedorMovimento } from "../ProvedorMovimento";
import { IndicadorPassos, TransicaoPasso } from "./Passos";
import { violacoesAcessibilidade } from "../testes/acessibilidade";

describe("IndicadorPassos", () => {
  it("o texto informa; a barra é decorativa", () => {
    const { container } = render(<IndicadorPassos actual={2} total={4} rotulo="Passo 2 de 4" />);
    expect(screen.getByText("Passo 2 de 4")).toBeInTheDocument();
    const barra = container.querySelector("[aria-hidden='true']");
    expect(barra?.children).toHaveLength(4);
    expect(barra?.querySelectorAll(".bg-accao")).toHaveLength(2);
  });
});

const Jornada = () => {
  const [passo, setPasso] = useState(1);
  const [direccao, setDireccao] = useState<1 | -1>(1);
  const ir = (n: number) => {
    setDireccao(n > passo ? 1 : -1);
    setPasso(n);
  };
  return (
    <ProvedorMovimento>
      <TransicaoPasso chave={passo} direccao={direccao}>
        <h2>Ecrã {passo}</h2>
        <button type="button" onClick={() => ir(passo + 1)}>
          Seguinte
        </button>
        <button type="button" onClick={() => ir(passo - 1)}>
          Anterior
        </button>
      </TransicaoPasso>
    </ProvedorMovimento>
  );
};

describe("TransicaoPasso", () => {
  it("no primeiro ecrã não rouba o foco (a página acabou de abrir)", () => {
    render(<Jornada />);
    expect(screen.getByRole("heading", { name: "Ecrã 1" })).not.toHaveFocus();
  });

  it("ao avançar, o foco vai para o título do ecrã novo (leitor de ecrã sabe que mudou)", async () => {
    render(<Jornada />);
    await userEvent.click(screen.getByRole("button", { name: "Seguinte" }));
    const titulo = await screen.findByRole("heading", { name: "Ecrã 2" });
    await waitFor(() => expect(titulo).toHaveFocus());
    expect(titulo).toHaveAttribute("tabindex", "-1");
  });

  it("ao voltar, o foco também vai para o título", async () => {
    render(<Jornada />);
    await userEvent.click(screen.getByRole("button", { name: "Seguinte" }));
    await screen.findByRole("heading", { name: "Ecrã 2" });
    await userEvent.click(await screen.findByRole("button", { name: "Anterior" }));
    const titulo = await screen.findByRole("heading", { name: "Ecrã 1" });
    await waitFor(() => expect(titulo).toHaveFocus());
  });

  it("sem violações de acessibilidade", async () => {
    const { container } = render(
      <div>
        <IndicadorPassos actual={1} total={3} rotulo="Passo 1 de 3" />
        <Jornada />
      </div>,
    );
    expect(await violacoesAcessibilidade(container)).toEqual([]);
  });
});
