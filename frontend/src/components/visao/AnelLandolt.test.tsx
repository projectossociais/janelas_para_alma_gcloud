import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import AnelLandolt from "./AnelLandolt";

describe("AnelLandolt", () => {
  it("sem barras: 5 aberturas de lado, nenhuma barra", () => {
    const { container } = render(<AnelLandolt aberturaPx={10} direccao={0} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("50");
    expect(container.querySelectorAll("[data-barra]")).toHaveLength(0);
  });

  it("com barras (Olhos de Palanca): 9 aberturas de lado e quatro barras que não rodam com o anel", () => {
    const { container } = render(<AnelLandolt aberturaPx={10} direccao={2} barras />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("90");
    expect(svg.getAttribute("viewBox")).toBe("-4.5 -4.5 9 9");
    const barras = container.querySelectorAll("[data-barra]");
    expect(barras).toHaveLength(4);
    barras.forEach((b) => expect(b.closest("g")).toBeNull());
  });
});
