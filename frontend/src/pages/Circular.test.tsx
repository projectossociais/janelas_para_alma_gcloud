import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Circular from "./Circular";

vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));

describe("Circular -- óculos 3D", () => {
  it("apresenta os óculos como material dos exercícios, não como produto à venda, nem ligado a materiais doados", () => {
    const { container } = render(<Circular />, { wrapper: MemoryRouter });
    const seccao = container.querySelector("#oculos-3d");

    expect(seccao).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Óculos 3D para os Exercícios Visuais" })).toBeInTheDocument();
    // Ainda não são um produto (coordenação, 2026-11-10): nada de produto, venda ou rendimento.
    expect(seccao?.textContent).not.toMatch(/produto|venda|rendimento|reverte|reinvest/i);
    expect(seccao).toHaveTextContent(/opcionais/i);
    // Nada de "doado", "reaproveitado", "reciclado" ou "recolha" na secção.
    expect(seccao?.textContent).not.toMatch(/doa|reaprove|recicl|recolha|papelão/i);
  });

  it("não tem botão \"Ver Óculos 3D\" enquanto não houver onde os vender", () => {
    render(<Circular />, { wrapper: MemoryRouter });

    expect(screen.queryByRole("link", { name: /Ver Óculos 3D/i })).not.toBeInTheDocument();
  });
});
