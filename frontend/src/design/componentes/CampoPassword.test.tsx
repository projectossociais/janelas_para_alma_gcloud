import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CampoPassword } from "./CampoPassword";
import { violacoesAcessibilidade } from "../testes/acessibilidade";

const TEXTOS = { mostrar: "Mostrar", esconder: "Esconder" };

describe("CampoPassword", () => {
  it("começa escondida, com autocomplete para os gestores de passwords", () => {
    render(<CampoPassword rotulo="Password" textos={TEXTOS} autoComplete="current-password" />);
    const campo = screen.getByLabelText("Password");
    expect(campo).toHaveAttribute("type", "password");
    expect(campo).toHaveAttribute("autocomplete", "current-password");
  });

  it("'Mostrar' revela a password e passa a 'Esconder', com aria-pressed", async () => {
    render(<CampoPassword rotulo="Password" textos={TEXTOS} autoComplete="new-password" />);
    const botao = screen.getByRole("button", { name: "Mostrar" });
    expect(botao).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(botao);
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Esconder" })).toHaveAttribute("aria-pressed", "true");
  });

  it("colar funciona (nunca bloquear o colar: WCAG 3.3.8)", async () => {
    render(<CampoPassword rotulo="Password" textos={TEXTOS} autoComplete="current-password" />);
    const campo = screen.getByLabelText("Password");
    campo.focus();
    await userEvent.paste("uma-password-longa");
    expect(campo).toHaveValue("uma-password-longa");
  });

  it("o botão não envia o formulário", async () => {
    let enviado = false;
    render(
      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviado = true;
        }}
      >
        <CampoPassword rotulo="Password" textos={TEXTOS} autoComplete="current-password" />
      </form>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Mostrar" }));
    expect(enviado).toBe(false);
  });

  it("sem violações de acessibilidade", async () => {
    const { container } = render(
      <CampoPassword rotulo="Password" ajuda="Pelo menos 8 caracteres" textos={TEXTOS} autoComplete="new-password" />,
    );
    expect(await violacoesAcessibilidade(container)).toEqual([]);
  });
});
