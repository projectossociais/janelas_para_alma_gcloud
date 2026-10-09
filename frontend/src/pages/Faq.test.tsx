import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Faq from "./Faq";
import { violacoesAcessibilidade } from "@/design/testes/acessibilidade";

const abrir = () =>
  render(
    <MemoryRouter>
      <Faq />
    </MemoryRouter>,
  );

describe("Faq", () => {
  it("a primeira resposta vem aberta; as outras abrem ao carregar na pergunta", async () => {
    const { container } = abrir();
    const blocos = container.querySelectorAll("details");
    expect(blocos.length).toBeGreaterThanOrEqual(5);
    expect(blocos[0]).toHaveAttribute("open");
    expect(blocos[1]).not.toHaveAttribute("open");
    await userEvent.click(blocos[1].querySelector("summary") as HTMLElement);
    expect(blocos[1]).toHaveAttribute("open");
  });

  it("as respostas ligam às páginas legais", () => {
    abrir();
    expect(screen.getAllByRole("link").some((l) => l.getAttribute("href") === "/politica-de-privacidade")).toBe(true);
  });

  it("sem violações de acessibilidade", async () => {
    const { container } = abrir();
    expect(await violacoesAcessibilidade(container)).toEqual([]);
  });
});
