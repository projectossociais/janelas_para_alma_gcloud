import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Circular from "./Circular";

vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));

describe("Circular -- óculos 3D", () => {
  it("apresenta os óculos como produto, sem os ligar a materiais doados ou reaproveitados", () => {
    const { container } = render(<Circular />, { wrapper: MemoryRouter });
    const seccao = container.querySelector("#oculos-3d");

    expect(seccao).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Óculos 3D para os Exercícios Visuais" })).toBeInTheDocument();
    expect(seccao).toHaveTextContent(/rendimento da venda/i);
    // Nada de "doado", "reaproveitado", "reciclado" ou "recolha" na secção.
    expect(seccao?.textContent).not.toMatch(/doa|reaprove|recicl|recolha|papelão/i);
  });

  it("o botão \"Ver Óculos 3D\" leva ao contacto enquanto não há página de venda", () => {
    render(<Circular />, { wrapper: MemoryRouter });

    expect(screen.getByRole("link", { name: /Ver Óculos 3D/i })).toHaveAttribute("href", "/junte-se");
  });
});
