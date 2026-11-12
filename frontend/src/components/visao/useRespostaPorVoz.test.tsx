import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useRespostaPorVoz } from "./useRespostaPorVoz";

// A voz respondia com um ou dois segundos de atraso (2026-11-11): esperava pelo
// resultado final, que o navegador só entrega depois de um silêncio. Agora a
// resposta conta assim que a palavra aparece no resultado provisório.

interface Falso {
  interimResults: boolean;
  onresult: ((e: unknown) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
let instancia: Falso | null = null;

beforeEach(() => {
  instancia = null;
  class Reconhecimento {
    lang = "";
    continuous = false;
    interimResults = false;
    onresult = null;
    onerror = null;
    onend = null;
    constructor() {
      instancia = this as unknown as Falso;
    }
    start() {}
    stop() {}
  }
  (window as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition = Reconhecimento;
});
afterEach(() => {
  delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
});

/** Um evento do reconhecimento: as frases até agora, a última ainda provisória ou já final. */
const evento = (frases: string[], final: boolean, resultIndex = frases.length - 1) => ({
  resultIndex,
  results: frases.map((transcript, i) => Object.assign([{ transcript }], { isFinal: i < frases.length - 1 || final })),
});

describe("useRespostaPorVoz", () => {
  it("responde logo ao resultado provisório, e a mesma frase não conta duas vezes", () => {
    const aoOuvir = vi.fn();
    renderHook(() => useRespostaPorVoz(true, "pt-AO", aoOuvir));
    expect(instancia!.interimResults).toBe(true);

    act(() => instancia!.onresult!(evento(["para ci"], false)));
    expect(aoOuvir).not.toHaveBeenCalled();
    act(() => instancia!.onresult!(evento(["para cima"], false)));
    expect(aoOuvir).toHaveBeenCalledTimes(1);
    expect(aoOuvir).toHaveBeenLastCalledWith("cima");
    // O resultado final da mesma frase chega depois: não é outra resposta.
    act(() => instancia!.onresult!(evento(["para cima"], true)));
    expect(aoOuvir).toHaveBeenCalledTimes(1);

    // A frase seguinte é outra resposta.
    act(() => instancia!.onresult!(evento(["para cima", "esquerda"], false)));
    expect(aoOuvir).toHaveBeenCalledTimes(2);
    expect(aoOuvir).toHaveBeenLastCalledWith("esquerda");
  });

  it("sem permissão para o microfone, avisa com `erro` e não responde", () => {
    const aoOuvir = vi.fn();
    const { result } = renderHook(() => useRespostaPorVoz(true, "pt-AO", aoOuvir));
    act(() => instancia!.onerror!({ error: "not-allowed" }));
    expect(result.current.erro).toBe(true);
    expect(result.current.aOuvir).toBe(false);
  });

  it("desligado, nem cria o reconhecimento", () => {
    renderHook(() => useRespostaPorVoz(false, "pt-AO", vi.fn()));
    expect(instancia).toBeNull();
  });
});
