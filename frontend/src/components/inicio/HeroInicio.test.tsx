import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const auth = { isLoggedIn: false };
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));

import HeroInicio, { DIAPOSITIVOS_CAPA, INTERVALO_CAPA_MS } from "./HeroInicio";

function visivel() {
  return screen.getAllByTestId("diapositivo-capa").findIndex((d) => d.className.includes("opacity-100"));
}

function renderCapa() {
  return render(
    <MemoryRouter>
      <HeroInicio />
    </MemoryRouter>,
  );
}

describe("HeroInicio (carrossel da capa)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    auth.isLoggedIn = false;
  });
  afterEach(() => vi.useRealTimers());

  it("muda de diapositivo a cada 5 s e volta ao primeiro no fim", () => {
    renderCapa();
    expect(visivel()).toBe(0);
    act(() => vi.advanceTimersByTime(INTERVALO_CAPA_MS - 1));
    expect(visivel()).toBe(0);
    act(() => vi.advanceTimersByTime(1));
    expect(visivel()).toBe(1);
    for (let i = 2; i <= DIAPOSITIVOS_CAPA.length; i++) act(() => vi.advanceTimersByTime(INTERVALO_CAPA_MS));
    expect(visivel()).toBe(0);
  });

  it("os botões Doar Agora e Entrar ficam visíveis em todos os diapositivos", () => {
    renderCapa();
    for (let i = 0; i < DIAPOSITIVOS_CAPA.length; i++) {
      expect(screen.getByRole("link", { name: /doar agora/i })).toBeVisible();
      expect(screen.getByRole("link", { name: /entrar/i })).toBeVisible();
      act(() => vi.advanceTimersByTime(INTERVALO_CAPA_MS));
    }
  });

  it("com sessão iniciada não mostra Entrar", () => {
    auth.isLoggedIn = true;
    renderCapa();
    expect(screen.queryByRole("link", { name: /entrar/i })).not.toBeInTheDocument();
  });

  it("os pontos levam ao diapositivo escolhido", () => {
    renderCapa();
    fireEvent.click(screen.getAllByRole("button")[2]);
    expect(visivel()).toBe(2);
  });
});
