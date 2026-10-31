import { afterEach, describe, expect, it, vi } from "vitest";
import { aoMudarSom, definirSom, sinalSonoro, somLigado } from "./voz";

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("som opcional", () => {
  it("começa desligado: sem bips", () => {
    const Contexto = vi.fn();
    vi.stubGlobal("AudioContext", Contexto);
    expect(somLigado()).toBe(false);
    sinalSonoro("certo");
    expect(Contexto).not.toHaveBeenCalled();
  });

  it("ligar e desligar fica guardado e avisa quem está a ouvir", () => {
    const aviso = vi.fn();
    const parar = aoMudarSom(aviso);
    definirSom(true);
    expect(somLigado()).toBe(true);
    definirSom(false);
    expect(somLigado()).toBe(false);
    expect(aviso).toHaveBeenCalledTimes(2);
    parar();
  });
});
