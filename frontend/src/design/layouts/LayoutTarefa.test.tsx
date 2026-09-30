import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProvedorMovimento } from "../ProvedorMovimento";
import { LayoutTarefa } from "./LayoutTarefa";
import { violacoesAcessibilidade } from "../testes/acessibilidade";

const CONFIRMAR = {
  titulo: "Sair do rastreio?",
  descricao: "O que fez até agora não fica guardado.",
  ficar: "Continuar o rastreio",
  sair: "Sair",
  fechar: "Fechar",
};

const montar = (aoSair = vi.fn(), confirmar = true) =>
  render(
    <ProvedorMovimento>
      <LayoutTarefa
        tema="claro"
        passo={{ actual: 2, total: 4, rotulo: "Passo 2 de 4" }}
        sair={{ rotulo: "Sair", aoSair }}
        confirmarSaida={confirmar ? CONFIRMAR : undefined}
        accao={<button type="button">Continuar</button>}
        textoSaltar="Saltar para o conteúdo"
      >
        <h1>Vamos usar a câmara</h1>
      </LayoutTarefa>
    </ProvedorMovimento>,
  );

describe("LayoutTarefa", () => {
  it("sem navegação do site: nenhuma ligação que tire da tarefa", () => {
    montar();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.queryAllByRole("link").map((l) => l.textContent)).toEqual(["Saltar para o conteúdo"]);
  });

  it("mostra o passo em que se está", () => {
    montar();
    expect(screen.getAllByText("Passo 2 de 4").length).toBeGreaterThan(0);
  });

  it("'Sair' pede confirmação; ficar não sai", async () => {
    const aoSair = vi.fn();
    montar(aoSair);
    await userEvent.click(screen.getByRole("button", { name: "Sair" }));
    const dialogo = await screen.findByRole("dialog", { name: "Sair do rastreio?" });
    expect(dialogo).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Continuar o rastreio" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(aoSair).not.toHaveBeenCalled();
  });

  it("confirmar a saída chama aoSair", async () => {
    const aoSair = vi.fn();
    montar(aoSair);
    await userEvent.click(screen.getByRole("button", { name: "Sair" }));
    const dialogo = await screen.findByRole("dialog");
    await userEvent.click(within(dialogo).getByRole("button", { name: "Sair" }));
    expect(aoSair).toHaveBeenCalledTimes(1);
  });

  it("sem nada por guardar, 'Sair' sai logo", async () => {
    const aoSair = vi.fn();
    montar(aoSair, false);
    await userEvent.click(screen.getByRole("button", { name: "Sair" }));
    expect(aoSair).toHaveBeenCalledTimes(1);
  });

  it("sem violações de acessibilidade", async () => {
    const { container } = montar();
    expect(await violacoesAcessibilidade(container)).toEqual([]);
  });
});
