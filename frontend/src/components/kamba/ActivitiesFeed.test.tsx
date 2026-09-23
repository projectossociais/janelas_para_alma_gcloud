import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import ActivitiesFeed from "./ActivitiesFeed";

describe("ActivitiesFeed", () => {
  it("mostra a campanha da Gamek com a foto de grupo da equipa", () => {
    render(<ActivitiesFeed />, { wrapper: MemoryRouter });

    expect(screen.getByText("Campanha de Consciencialização na Gamek")).toBeInTheDocument();
    expect(
      screen.getByAltText("Equipa do Janelas Para a Alma reunida na campanha da Gamek"),
    ).toBeInTheDocument();
  });

  it("liga o botão à sub-página da campanha, com o artigo completo e o cartaz", () => {
    render(<ActivitiesFeed />, { wrapper: MemoryRouter });

    const link = screen.getByRole("link", { name: /Ver Galeria da Acção/i });
    expect(link).toHaveAttribute("href", "/meu-kamba/campanha-gamek");
  });
});
