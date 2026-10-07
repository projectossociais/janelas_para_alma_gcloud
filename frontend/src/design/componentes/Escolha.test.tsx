import { describe, expect, it, vi } from "vitest";
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

  it("aparência 'radio': botões de rádio sem caixa, todos na mesma linha, com o estado marcado", async () => {
    const aoMudar = vi.fn();
    const { container } = render(
      <GrupoEscolha<"a" | "b" | "c">
        legenda="Género"
        aparencia="radio"
        opcoes={[
          { valor: "a", rotulo: "Masculino" },
          { valor: "b", rotulo: "Feminino" },
          { valor: "c", rotulo: "Prefiro não dizer" },
        ]}
        valor="b"
        aoMudar={aoMudar}
      />,
    );
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
    expect(screen.getByRole("radio", { name: "Feminino" })).toBeChecked();
    // Sem caixa à volta (não são botões grandes) e a quebrar só se não couber.
    expect(container.querySelector("fieldset > div")!.className).toContain("flex-wrap");
    expect(container.querySelector("label")!.className).not.toContain("border");
    await userEvent.setup().click(screen.getByRole("radio", { name: "Prefiro não dizer" }));
    expect(aoMudar).toHaveBeenCalledWith("c");
  });

  it("por omissão, as pastilhas ficam em grelha (dias e horas)", () => {
    const { container } = render(
      <GrupoEscolha<"a" | "b">
        legenda="Hora"
        aparencia="pastilha"
        opcoes={[
          { valor: "a", rotulo: "09:00" },
          { valor: "b", rotulo: "10:00" },
        ]}
        valor={null}
        aoMudar={() => {}}
      />,
    );
    expect(container.querySelector("fieldset > div")!.className).toContain("grid");
  });
});
