import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Botao } from "./Botao";
import { Dialogo, DialogoConteudo, DialogoFechar, DialogoGatilho } from "./Dialogo";
import { violacoesAcessibilidade } from "../testes/acessibilidade";

const Exemplo = () => (
  <Dialogo>
    <DialogoGatilho asChild>
      <Botao variante="perigo">Retirar autorização</Botao>
    </DialogoGatilho>
    <DialogoConteudo
      titulo="Retirar autorização?"
      descricao="Deixamos de gravar resultados novos."
      rotuloFechar="Fechar"
      rodape={
        <>
          <DialogoFechar asChild>
            <Botao variante="secundario">Cancelar</Botao>
          </DialogoFechar>
          <Botao variante="perigo">Retirar</Botao>
        </>
      }
    />
  </Dialogo>
);

describe("Dialogo", () => {
  it("abre como diálogo com nome e descrição", async () => {
    render(<Exemplo />);
    await userEvent.click(screen.getByRole("button", { name: "Retirar autorização" }));
    const dialogo = await screen.findByRole("dialog", { name: "Retirar autorização?" });
    expect(dialogo).toHaveAccessibleDescription("Deixamos de gravar resultados novos.");
  });

  it("Esc fecha e o foco volta ao botão que o abriu", async () => {
    render(<Exemplo />);
    const gatilho = screen.getByRole("button", { name: "Retirar autorização" });
    await userEvent.click(gatilho);
    await screen.findByRole("dialog");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(gatilho).toHaveFocus();
  });

  it("o X tem nome acessível e fecha", async () => {
    render(<Exemplo />);
    await userEvent.click(screen.getByRole("button", { name: "Retirar autorização" }));
    await userEvent.click(await screen.findByRole("button", { name: "Fechar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("'Cancelar' no rodapé fecha", async () => {
    render(<Exemplo />);
    await userEvent.click(screen.getByRole("button", { name: "Retirar autorização" }));
    await userEvent.click(await screen.findByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("sem violações de acessibilidade com o diálogo aberto", async () => {
    render(<Exemplo />);
    await userEvent.click(screen.getByRole("button", { name: "Retirar autorização" }));
    await screen.findByRole("dialog");
    expect(await violacoesAcessibilidade(document.body)).toEqual([]);
  });
});
