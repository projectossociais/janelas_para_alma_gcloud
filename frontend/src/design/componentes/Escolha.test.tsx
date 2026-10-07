import { describe, expect, it } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GrupoEscolha } from "./Escolha";
import { violacoesAcessibilidade } from "../testes/acessibilidade";

const OPCOES = [
  { valor: "presencial", rotulo: "Presencial", descricao: "Na clínica, em Luanda" },
  { valor: "online", rotulo: "Por vídeo" },
] as const;

const Controlado = ({ aparencia }: { aparencia?: "cartao" | "pastilha" }) => {
  const [v, setV] = useState<"presencial" | "online" | null>(null);
  return <GrupoEscolha legenda="Como prefere?" opcoes={OPCOES} valor={v} aoMudar={(x) => setV(x)} aparencia={aparencia} />;
};

describe("GrupoEscolha", () => {
  it("é um grupo com a pergunta como nome, e botões de opção", () => {
    render(<Controlado />);
    expect(screen.getByRole("group", { name: "Como prefere?" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });

  it("tocar numa linha escolhe-a, e só uma fica escolhida", async () => {
    render(<Controlado />);
    await userEvent.click(screen.getByText("Presencial"));
    expect(screen.getByRole("radio", { name: "Presencial" })).toBeChecked();
    await userEvent.click(screen.getByText("Por vídeo"));
    expect(screen.getByRole("radio", { name: "Presencial" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "Por vídeo" })).toBeChecked();
  });

  it("as setas mudam de opção", async () => {
    render(<Controlado />);
    await userEvent.click(screen.getByText("Presencial"));
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: "Por vídeo" })).toBeChecked();
  });

  it("a descrição descreve a opção", () => {
    render(<Controlado />);
    expect(screen.getByRole("radio", { name: "Presencial" })).toHaveAccessibleDescription("Na clínica, em Luanda");
  });

  it("uma pastilha abreviada tem o nome completo para o leitor de ecrã", () => {
    render(
      <GrupoEscolha
        legenda="Dia"
        aparencia="pastilha"
        opcoes={[{ valor: "d1", rotulo: "seg. 6", rotuloAcessivel: "segunda-feira, 6 de outubro" }]}
        valor={null}
        aoMudar={() => {}}
      />,
    );
    expect(screen.getByRole("radio", { name: "segunda-feira, 6 de outubro" })).toBeInTheDocument();
  });

  it.each(["cartao", "pastilha"] as const)("sem violações de acessibilidade (%s)", async (aparencia) => {
    const { container } = render(<Controlado aparencia={aparencia} />);
    expect(await violacoesAcessibilidade(container)).toEqual([]);
  });
});
