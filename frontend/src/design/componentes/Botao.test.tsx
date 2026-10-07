import { describe, expect, it, vi } from "vitest";
import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Botao } from "./Botao";
import { violacoesAcessibilidade } from "../testes/acessibilidade";

describe("Botao", () => {
  it("é um botão com nome acessível, do tipo 'button' por omissão (nunca envia um formulário por engano)", () => {
    render(<Botao>Marcar consulta</Botao>);
    const b = screen.getByRole("button", { name: "Marcar consulta" });
    expect(b).toHaveAttribute("type", "button");
  });

  it("respeita type='submit' quando pedido", () => {
    render(<Botao type="submit">Enviar</Botao>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });

  it("chama onClick", async () => {
    const onClick = vi.fn();
    render(<Botao onClick={onClick}>Continuar</Botao>);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("a carregar: anuncia aria-busy, bloqueia cliques e mantém o nome para leitores de ecrã", async () => {
    const onClick = vi.fn();
    render(
      <Botao aCarregar onClick={onClick}>
        Guardar
      </Botao>,
    );
    const b = screen.getByRole("button", { name: "Guardar" });
    expect(b).toHaveAttribute("aria-busy", "true");
    expect(b).toBeDisabled();
    await userEvent.click(b);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("desactivado não chama onClick", async () => {
    const onClick = vi.fn();
    render(
      <Botao disabled onClick={onClick}>
        Continuar
      </Botao>,
    );
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("asChild aplica o aspecto a uma ligação, sem type nem disabled de botão", () => {
    render(
      <Botao asChild variante="secundario">
        <a href="/rastreio">Fazer rastreio</a>
      </Botao>,
    );
    const a = screen.getByRole("link", { name: "Fazer rastreio" });
    expect(a).toHaveAttribute("href", "/rastreio");
    expect(a).not.toHaveAttribute("type");
    expect(a.className).toContain("border-accao");
  });

  it("encaminha a ref para o <button>", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Botao ref={ref}>Ok</Botao>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it("className de quem usa ganha aos conflitos (o último manda)", () => {
    render(<Botao className="px-2">Ok</Botao>);
    const c = screen.getByRole("button").className;
    expect(c).toContain("px-2");
    expect(c).not.toContain("px-5");
  });

  it("sem violações de acessibilidade em nenhuma variante nem estado", async () => {
    const { container } = render(
      <div>
        <Botao>Primário</Botao>
        <Botao variante="secundario">Secundário</Botao>
        <Botao variante="fantasma">Fantasma</Botao>
        <Botao variante="perigo">Eliminar</Botao>
        <Botao aCarregar>A guardar</Botao>
        <Botao disabled>Desactivado</Botao>
        <Botao asChild>
          <a href="/x">Ligação</a>
        </Botao>
      </div>,
    );
    expect(await violacoesAcessibilidade(container)).toEqual([]);
  });
});
