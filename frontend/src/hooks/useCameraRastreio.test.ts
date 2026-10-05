import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { ESPERA_DETECTOR, useCameraRastreio } from "./useCameraRastreio";

const parar = vi.fn();
const getUserMedia = vi.fn();
let pixel = 200;

/** Um <video> "pronto" (readyState 2) para as leituras de luz e a fotografia. */
function videoPronto() {
  const video = document.createElement("video");
  Object.defineProperty(video, "readyState", { value: 2 });
  Object.defineProperty(video, "videoWidth", { value: 640 });
  Object.defineProperty(video, "videoHeight", { value: 480 });
  return video;
}

beforeEach(() => {
  vi.useFakeTimers();
  parar.mockReset();
  pixel = 200;
  getUserMedia.mockReset().mockResolvedValue({ getTracks: () => [{ stop: parar }] });
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation(() => ({
    drawImage: vi.fn(),
    getImageData: () => ({ data: new Uint8ClampedArray(4 * 16).fill(pixel) }),
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.toDataURL = vi.fn().mockReturnValue("data:image/jpeg;base64,AAAA");
});

afterEach(() => vi.useRealTimers());

async function ligada() {
  const r = renderHook(() => useCameraRastreio());
  await act(async () => {
    await r.result.current.ligar();
  });
  return r;
}

describe("useCameraRastreio", () => {
  it("liga a câmara frontal, sem áudio", async () => {
    const { result } = await ligada();
    expect(result.current.estado).toBe("ligada");
    expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({ audio: false }));
  });

  it("autorização recusada é 'recusada'; outra falha é 'indisponivel'", async () => {
    getUserMedia.mockRejectedValueOnce(Object.assign(new Error("x"), { name: "NotAllowedError" }));
    const a = renderHook(() => useCameraRastreio());
    await act(async () => {
      expect(await a.result.current.ligar()).toBe(false);
    });
    expect(a.result.current.estado).toBe("recusada");

    getUserMedia.mockRejectedValueOnce(Object.assign(new Error("x"), { name: "NotReadableError" }));
    const b = renderHook(() => useCameraRastreio());
    await act(async () => {
      await b.result.current.ligar();
    });
    expect(b.result.current.estado).toBe("indisponivel");
  });

  it("página não segura (http por IP da rede): 'sem-suporte', sem pedir a câmara", async () => {
    // Caso real (2026-10-05): iPhone por http://192.168.x.x — o browser esconde a
    // câmara e a mensagem dizia "outra aplicação está a usá-la".
    const original = window.isSecureContext;
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: false });
    try {
      const { result } = renderHook(() => useCameraRastreio());
      await act(async () => {
        expect(await result.current.ligar()).toBe(false);
      });
      expect(result.current.estado).toBe("sem-suporte");
      expect(getUserMedia).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, "isSecureContext", { configurable: true, value: original });
    }
  });

  it("browser sem acesso à câmara (sem mediaDevices): 'sem-suporte'", async () => {
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: undefined });
    const { result } = renderHook(() => useCameraRastreio());
    await act(async () => {
      await result.current.ligar();
    });
    expect(result.current.estado).toBe("sem-suporte");
  });

  it("o <video> que aparece depois de a câmara ligar recebe o fluxo", async () => {
    const { result } = await ligada();
    const video = videoPronto();
    act(() => result.current.refVideo(video));
    expect(video.srcObject).not.toBeNull();
  });

  it("só deixa fotografar com rosto visível e luz suficiente", async () => {
    const { result } = await ligada();
    act(() => result.current.refVideo(videoPronto()));
    expect(result.current.podeFotografar).toBe(false); // ainda sem rosto

    act(() => result.current.aoDetectar(true));
    expect(result.current.podeFotografar).toBe(true);

    pixel = 20;
    act(() => vi.advanceTimersByTime(800));
    expect(result.current.escuro).toBe(true);
    expect(result.current.podeFotografar).toBe(false);
  });

  it("se o detector nunca responder, o rosto deixa de bloquear (a API verifica no fim)", async () => {
    const { result } = await ligada();
    act(() => result.current.refVideo(videoPronto()));
    expect(result.current.rostoOk).toBe(false);
    act(() => vi.advanceTimersByTime(ESPERA_DETECTOR + 10));
    expect(result.current.rostoOk).toBe(true);
    expect(result.current.rostoVisivel).toBe(false);
  });

  it("com o detector a responder, 'sem rosto' continua a bloquear", async () => {
    const { result } = await ligada();
    act(() => result.current.aoDetectar(false));
    act(() => vi.advanceTimersByTime(ESPERA_DETECTOR + 10));
    expect(result.current.rostoOk).toBe(false);
  });

  it("fotografar devolve um JPEG; sem vídeo devolve null", async () => {
    const { result } = await ligada();
    expect(result.current.fotografar()).toBeNull();
    act(() => result.current.refVideo(videoPronto()));
    expect(result.current.fotografar()).toMatch(/^data:image\/jpeg/);
  });

  it("desligar e sair do ecrã param a câmara", async () => {
    const a = await ligada();
    act(() => a.result.current.desligar());
    expect(parar).toHaveBeenCalledTimes(1);
    expect(a.result.current.estado).toBe("desligada");

    const b = await ligada();
    b.unmount();
    expect(parar).toHaveBeenCalledTimes(2);
  });
});
