import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import MedirDistancia from "./MedirDistancia";
import ptAO from "@/i18n/locales/pt-AO.json";

const V = ptAO.Visao;

// Régua Invisível: distância pelo ponto cego. Relógio e animação falsos, para
// saber exactamente onde está o ponto quando a pessoa toca. Com 4 px/mm e uma
// janela de 1200 px, o ponto cabe até ~1,1 m.
const PX_POR_MM = 4;
/** O ponto parte 0,9 s depois e anda 25 mm/s a partir de 20 mm do quadrado. */
const msAteDesvio = (mm: number) => 900 + ((mm - 20) / 25) * 1000;
/** A 50 cm, o ponto cego começa a ~120 mm do quadrado (tan 13,5°). */
const MS_50_CM = msAteDesvio(120);

let larguraOriginal: PropertyDescriptor | undefined;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "requestAnimationFrame", "cancelAnimationFrame", "performance"] });
  larguraOriginal = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 1200 });
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1200 });
});

afterEach(() => {
  vi.useRealTimers();
  if (larguraOriginal) Object.defineProperty(HTMLElement.prototype, "clientWidth", larguraOriginal);
});

const avancar = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const tecla = () => act(() => void fireEvent.keyDown(window, { key: " " }));

const montar = (olho: "direito" | "esquerdo" = "esquerdo") => {
  const aoMedir = vi.fn();
  const aoDesistir = vi.fn();
  render(<MedirDistancia pxPorMm={PX_POR_MM} olho={olho} aoMedir={aoMedir} aoDesistir={aoDesistir} />);
  return { aoMedir, aoDesistir };
};

describe("MedirDistancia", () => {
  it("pede para tapar o outro olho (mede-se com o que vê melhor)", () => {
    montar("esquerdo");
    expect(screen.getByText("Tape o olho direito com a mão.")).toBeInTheDocument();
  });

  it("três toques quando o ponto some a 120 mm dão 50 cm", () => {
    const { aoMedir } = montar();
    fireEvent.click(screen.getByRole("button", { name: V.medirComecar }));
    for (let i = 0; i < 3; i++) {
      avancar(MS_50_CM);
      tecla();
    }
    expect(screen.getByText("Está a cerca de 50 cm do ecrã")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(aoMedir).toHaveBeenCalledWith(500);
  });

  it("um toque cedo demais não conta", () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: V.medirComecar }));
    avancar(msAteDesvio(30)); // 30 mm -> ~12 cm: impossível
    tecla();
    expect(screen.getByText(V.medirCedoDemais)).toBeInTheDocument();
    // Continuam a ser precisas três medições válidas, e o toque cedo não entra na média.
    for (let i = 0; i < 2; i++) {
      avancar(MS_50_CM);
      tecla();
    }
    expect(screen.getByText("Medições: 2 de 3")).toBeInTheDocument();
    avancar(MS_50_CM);
    tecla();
    expect(screen.getByText("Está a cerca de 50 cm do ecrã")).toBeInTheDocument();
  });

  it("toques entre passagens são ignorados", () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: V.medirComecar }));
    avancar(300); // o ponto ainda não partiu
    tecla();
    expect(screen.queryByText(V.medirCedoDemais)).not.toBeInTheDocument();
    expect(screen.getByText("Medições: 0 de 3")).toBeInTheDocument();
  });

  it("se o ponto chega à borda duas vezes sem sumir, sugere aproximar ou rodar o ecrã", () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: V.medirComecar }));
    avancar(30000);
    expect(screen.getByText(V.medirNaoSumiuTitulo)).toBeInTheDocument();
  });

  it("medições que não concordam acabam em 'tente de novo'", () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: V.medirComecar }));
    for (const desvio of [80, 120, 170, 220, 270]) {
      avancar(msAteDesvio(desvio));
      tecla();
    }
    expect(screen.getByText(V.medirInconsistenteTitulo)).toBeInTheDocument();
  });

  it("'Escolher sem medir' sai da medição", () => {
    const { aoDesistir } = montar();
    fireEvent.click(screen.getByRole("button", { name: V.medirSemMedir }));
    expect(aoDesistir).toHaveBeenCalled();
  });
});
