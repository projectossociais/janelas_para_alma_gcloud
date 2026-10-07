import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LinhaCopiar } from "./LinhaCopiar";
import { violacoesAcessibilidade } from "../testes/acessibilidade";

const TEXTOS = { copiar: "Copiar", copiado: "Copiado" };

afterEach(() => vi.restoreAllMocks());

describe("LinhaCopiar", () => {
  it("mostra a versão ofuscada mas copia sempre o valor inteiro", async () => {
    const escrever = vi.fn().mockResolvedValue(undefined);
    const u = userEvent.setup();
    // O userEvent instala o seu próprio clipboard: espia-se depois do setup.
    vi.spyOn(navigator.clipboard, "writeText").mockImplementation(escrever);
    render(<LinhaCopiar rotulo="IBAN" valor="AO06 0040 0000 9103" mostrado="AO06****9103" textos={TEXTOS} />);
    expect(screen.getByText("AO06****9103")).toBeInTheDocument();
    expect(screen.queryByText("AO06 0040 0000 9103")).not.toBeInTheDocument();

    await u.click(screen.getByRole("button", { name: "Copiar" }));

    expect(escrever).toHaveBeenCalledWith("AO06 0040 0000 9103");
    expect(await screen.findByText("Copiado")).toBeInTheDocument();
  });

  it("se o navegador recusar copiar, nunca diz 'Copiado'", async () => {
    const u = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("sem permissão"));
    render(<LinhaCopiar rotulo="IBAN" valor="AO06" textos={TEXTOS} />);

    await u.click(screen.getByRole("button", { name: "Copiar" }));

    expect(screen.queryByText("Copiado")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copiar" })).toBeInTheDocument();
  });

  it("sem violações de acessibilidade", async () => {
    const { container } = render(<LinhaCopiar rotulo="IBAN" valor="AO06" textos={TEXTOS} />);
    expect(await violacoesAcessibilidade(container)).toEqual([]);
  });
});
