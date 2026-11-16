import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const auth = { isLoggedIn: false };
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));

import HeroInicio, { DIAPOSITIVOS_CAPA, INTERVALO_CAPA_MS } from "./HeroInicio";
import { NUMEROS_CAPA } from "./numerosCapa";
import i18n from "@/i18n";
import { IDIOMA_EN, IDIOMA_PT } from "@/i18n/idiomas";

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

  it("os botões Doar Agora, Exercícios Visuais e Entrar ficam visíveis em todos os diapositivos", () => {
    renderCapa();
    for (let i = 0; i < DIAPOSITIVOS_CAPA.length; i++) {
      expect(screen.getByRole("link", { name: /doar agora/i })).toBeVisible();
      expect(screen.getByRole("link", { name: /exercícios visuais/i })).toHaveAttribute("href", "/exercicios");
      expect(screen.getByRole("link", { name: /entrar/i })).toBeVisible();
      act(() => vi.advanceTimersByTime(INTERVALO_CAPA_MS));
    }
  });

  it("mostra os números do projecto", () => {
    renderCapa();
    for (const n of NUMEROS_CAPA) expect(screen.getByText(n.valor)).toBeInTheDocument();
  });

  it("em inglês, os números usam o formato inglês (293 mil → 293,000)", async () => {
    await i18n.changeLanguage(IDIOMA_EN);
    try {
      renderCapa();
      expect(screen.getByText("293,000")).toBeInTheDocument();
      expect(screen.queryByText("293 mil")).not.toBeInTheDocument();
      expect(screen.getByText("702")).toBeInTheDocument();
    } finally {
      await i18n.changeLanguage(IDIOMA_PT);
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
