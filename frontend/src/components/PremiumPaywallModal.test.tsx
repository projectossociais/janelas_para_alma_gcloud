import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PremiumPaywallModal from "./PremiumPaywallModal";

// Fase B (docs/ANALISE_EXERCICIOS.md): o Premium vende acompanhamento do
// tratamento e só promete o que existe na plataforma.

describe("PremiumPaywallModal", () => {
  it("vende acompanhamento, sem prometer vídeos nem usar jargão", () => {
    render(
      <MemoryRouter>
        <PremiumPaywallModal open onOpenChange={() => undefined} />
      </MemoryRouter>,
    );
    expect(screen.getByText("Acompanhe o tratamento em casa")).toBeInTheDocument();
    expect(screen.getByText(/Relatório semanal para mostrar ao oftalmologista/)).toBeInTheDocument();
    const dialogo = screen.getByRole("dialog");
    expect(dialogo).not.toHaveTextContent(/v[íi]deo/i);
    expect(dialogo).not.toHaveTextContent(/KPI/);
  });
});
