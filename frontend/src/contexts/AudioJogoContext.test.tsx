import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  AudioJogoProvider,
  CHAVE_PREFERENCIAS_AUDIO,
  lerPreferenciasAudio,
  useAudioJogo,
  useMusicaDeFundo,
} from "./AudioJogoContext";

// jsdom não reproduz áudio: `play`/`pause` são espiões, e cada `new Audio`
// fica registado para se saber que ficheiro tocou.
const tocados: string[] = [];
let play: ReturnType<typeof vi.spyOn>;
let pause: ReturnType<typeof vi.spyOn>;

let ctx: ReturnType<typeof useAudioJogo> | null = null;
const Consumidor = ({ musica = false }: { musica?: boolean }) => {
  ctx = useAudioJogo();
  useMusicaDeFundo(musica);
  return null;
};

const montar = (musica = false) =>
  render(
    <AudioJogoProvider>
      <Consumidor musica={musica} />
    </AudioJogoProvider>
  );

const primeiroToque = () => act(() => void fireEvent.pointerDown(window));

describe("AudioJogoContext", () => {
  beforeEach(() => {
    window.localStorage.clear();
    tocados.length = 0;
    ctx = null;
    play = vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) {
      tocados.push(this.src);
      return Promise.resolve();
    });
    pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  });

  afterEach(() => {
    // Desmonta antes de restaurar -- o provider pára a música ao desmontar.
    cleanup();
    vi.restoreAllMocks();
  });

  it("por omissão, música e efeitos estão ligados", () => {
    montar();
    expect(ctx!.musica).toBe(true);
    expect(ctx!.efeitos).toBe(true);
  });

  it("lê as preferências guardadas neste dispositivo", () => {
    window.localStorage.setItem(CHAVE_PREFERENCIAS_AUDIO, JSON.stringify({ musica: false, efeitos: true }));
    montar();
    expect(ctx!.musica).toBe(false);
    expect(ctx!.efeitos).toBe(true);
  });

  it("mudar uma preferência guarda-a no localStorage", () => {
    montar();
    act(() => ctx!.definirEfeitos(false));
    expect(JSON.parse(window.localStorage.getItem(CHAVE_PREFERENCIAS_AUDIO)!)).toEqual({ musica: true, efeitos: false });
    act(() => ctx!.definirMusica(false));
    expect(JSON.parse(window.localStorage.getItem(CHAVE_PREFERENCIAS_AUDIO)!)).toEqual({ musica: false, efeitos: false });
  });

  it("com o localStorage indisponível, usa as de omissão e não rebenta", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    expect(lerPreferenciasAudio()).toEqual({ musica: true, efeitos: true });
    montar();
    act(() => ctx!.definirMusica(false));
    expect(ctx!.musica).toBe(false);
  });

  it("ignora valores guardados inválidos", () => {
    window.localStorage.setItem(CHAVE_PREFERENCIAS_AUDIO, "{isto não é json");
    expect(lerPreferenciasAudio()).toEqual({ musica: true, efeitos: true });
    window.localStorage.setItem(CHAVE_PREFERENCIAS_AUDIO, JSON.stringify({ musica: "sim" }));
    expect(lerPreferenciasAudio()).toEqual({ musica: true, efeitos: true });
  });

  describe("política de autoplay", () => {
    it("a música não toca antes do primeiro toque do jogador", () => {
      montar(true);
      expect(play).not.toHaveBeenCalled();

      primeiroToque();

      expect(tocados.some((src) => src.endsWith("/audio/jogo/musica-fundo.wav"))).toBe(true);
    });

    it("os efeitos também esperam pelo primeiro toque", () => {
      montar();
      act(() => ctx!.tocarEfeito("certo"));
      expect(play).not.toHaveBeenCalled();

      primeiroToque();
      act(() => ctx!.tocarEfeito("certo"));
      expect(tocados).toEqual([expect.stringMatching(/\/audio\/jogo\/certo\.wav$/)]);
    });

    it("uma tecla também desbloqueia", () => {
      montar(true);
      act(() => void fireEvent.keyDown(window, { key: "Enter" }));
      expect(play).toHaveBeenCalled();
    });
  });

  it("a música de fundo toca em loop e só enquanto alguma página a pede", () => {
    const { rerender } = montar(false);
    primeiroToque();
    expect(play).not.toHaveBeenCalled();

    rerender(
      <AudioJogoProvider>
        <Consumidor musica />
      </AudioJogoProvider>
    );
    expect(play).toHaveBeenCalledTimes(1);
    const audio = play.mock.contexts[0] as HTMLMediaElement;
    expect(audio.loop).toBe(true);

    rerender(
      <AudioJogoProvider>
        <Consumidor musica={false} />
      </AudioJogoProvider>
    );
    expect(pause).toHaveBeenCalled();
  });

  it("desligar a música nas Definições pára-a", () => {
    montar(true);
    primeiroToque();
    pause.mockClear();
    act(() => ctx!.definirMusica(false));
    expect(pause).toHaveBeenCalled();
  });

  it("com a música desligada, nunca começa", () => {
    window.localStorage.setItem(CHAVE_PREFERENCIAS_AUDIO, JSON.stringify({ musica: false, efeitos: true }));
    montar(true);
    primeiroToque();
    expect(tocados.some((src) => src.includes("musica-fundo"))).toBe(false);
  });

  it("com os efeitos desligados, nenhum efeito toca", () => {
    montar();
    primeiroToque();
    act(() => ctx!.definirEfeitos(false));
    act(() => ctx!.tocarEfeito("errado"));
    act(() => ctx!.tocarEfeito("levelUp"));
    expect(play).not.toHaveBeenCalled();
  });

  it("a música pára quando a página fica escondida e volta quando reaparece", () => {
    montar(true);
    primeiroToque();
    pause.mockClear();
    play.mockClear();

    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    expect(pause).toHaveBeenCalled();

    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    expect(play).toHaveBeenCalled();
  });

  it("um play recusado pelo browser não rebenta o jogo", async () => {
    play.mockImplementation(() => Promise.reject(new Error("NotAllowedError")));
    montar(true);
    primeiroToque();
    act(() => ctx!.tocarEfeito("clique"));
    await act(async () => {});
    expect(screen.queryByText(/erro/i)).not.toBeInTheDocument();
  });
});
