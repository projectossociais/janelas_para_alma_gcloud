import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import OlharesCarrossel, { FOTOS_OLHARES, INTERVALO_OLHARES_MS } from "./OlharesCarrossel";

function fotoVisivel() {
  return screen.getAllByRole("img", { hidden: true }).find((img) => img.className.includes("opacity-100"))!;
}

describe("OlharesCarrossel", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("muda de fotografia a cada 5 s e volta à primeira no fim", () => {
    render(<OlharesCarrossel />);
    expect(fotoVisivel()).toHaveAttribute("src", FOTOS_OLHARES[0]);

    act(() => vi.advanceTimersByTime(INTERVALO_OLHARES_MS - 1));
    expect(fotoVisivel()).toHaveAttribute("src", FOTOS_OLHARES[0]);
    act(() => vi.advanceTimersByTime(1));
    expect(fotoVisivel()).toHaveAttribute("src", FOTOS_OLHARES[1]);

    for (let i = 2; i <= FOTOS_OLHARES.length; i++) act(() => vi.advanceTimersByTime(INTERVALO_OLHARES_MS));
    expect(fotoVisivel()).toHaveAttribute("src", FOTOS_OLHARES[0]);
  });

  it("pára enquanto o rato está no carrossel e deixa escolher pelos pontos", () => {
    const { container } = render(<OlharesCarrossel />);
    const regiao = container.querySelector('[aria-roledescription="carousel"]')!;
    fireEvent.mouseEnter(regiao.parentElement!);
    act(() => vi.advanceTimersByTime(INTERVALO_OLHARES_MS * 3));
    expect(fotoVisivel()).toHaveAttribute("src", FOTOS_OLHARES[0]);

    fireEvent.click(screen.getAllByRole("button")[3]);
    expect(fotoVisivel()).toHaveAttribute("src", FOTOS_OLHARES[3]);
  });
});
