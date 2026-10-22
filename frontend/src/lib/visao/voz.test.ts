import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aoMudarSom, definirSom, falar, sinalSonoro, somLigado } from "./voz";

const sintese = { speak: vi.fn(), cancel: vi.fn(), getVoices: () => [] };

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal("speechSynthesis", sintese);
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class {
      constructor(public text: string) {}
    },
  );
  sintese.speak.mockClear();
  sintese.cancel.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("som opcional", () => {
  it("começa desligado: nada fala sozinho", () => {
    expect(somLigado()).toBe(false);
    expect(falar("Olá", "pt-AO")).toBe(false);
    expect(sintese.speak).not.toHaveBeenCalled();
  });

  it("'Ouvir as instruções' fala mesmo com o som desligado", () => {
    expect(falar("Olá", "pt-AO", { pedido: true })).toBe(true);
    expect(sintese.speak).toHaveBeenCalledTimes(1);
  });

  it("ligado, fala; desligar cala logo e avisa quem está a ouvir", () => {
    const aviso = vi.fn();
    const parar = aoMudarSom(aviso);
    definirSom(true);
    expect(somLigado()).toBe(true);
    expect(falar("Olá", "pt-AO")).toBe(true);
    definirSom(false);
    expect(sintese.cancel).toHaveBeenCalled();
    expect(aviso).toHaveBeenCalledTimes(2);
    expect(falar("Olá", "pt-AO")).toBe(false);
    parar();
  });

  it("sem som, nem os bips", () => {
    const Contexto = vi.fn();
    vi.stubGlobal("AudioContext", Contexto);
    sinalSonoro("certo");
    expect(Contexto).not.toHaveBeenCalled();
  });
});
