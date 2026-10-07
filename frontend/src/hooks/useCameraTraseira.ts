import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Câmara traseira com luz contínua e fotografia em resolução total: o caminho A
 * do rastreio completo (docs/MOTOR_ANALISE_RASTREIO.md §5). Só existe onde o
 * browser tem `ImageCapture` (Chrome e Samsung Internet em Android); no iPhone
 * (todos os browsers usam o motor do Safari) a captura vai pela câmara nativa
 * (caminho B, `<input capture>`), sem este hook.
 *
 * As fotografias saem como `ImageBitmap` na memória: nunca se escrevem em disco
 * nem se enviam (CLAUDE.md §4, regra 4).
 */

// A API ImageCapture não está nos tipos do TypeScript.
interface ImageCaptureLike {
  takePhoto(): Promise<Blob>;
}
declare const ImageCapture: { new (track: MediaStreamTrack): ImageCaptureLike } | undefined;

export type EstadoCameraTraseira = "desligada" | "a-ligar" | "ligada" | "recusada" | "indisponivel" | "sem-suporte";

/** O caminho A só serve com página segura, câmara e fotografia em resolução total. */
export function suportaCaminhoA(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext !== false &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof ImageCapture !== "undefined"
  );
}

const espera = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

export function useCameraTraseira() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fluxo = useRef<MediaStream | null>(null);
  const luz = useRef(false);
  const [estado, setEstado] = useState<EstadoCameraTraseira>("desligada");
  const [luzDisponivel, setLuzDisponivel] = useState(false);

  const faixa = () => fluxo.current?.getVideoTracks()[0] ?? null;

  const definirLuz = useCallback(async (ligar: boolean) => {
    const t = faixa();
    if (!t) return false;
    try {
      await t.applyConstraints({ advanced: [{ torch: ligar } as MediaTrackConstraintSet] });
      luz.current = ligar;
      return true;
    } catch {
      luz.current = false;
      return false;
    }
  }, []);

  const desligar = useCallback(() => {
    fluxo.current?.getTracks().forEach((t) => t.stop());
    fluxo.current = null;
    luz.current = false;
    setLuzDisponivel(false);
    setEstado("desligada");
  }, []);

  // A câmara (e a luz) desligam-se sempre ao sair do ecrã.
  useEffect(() => () => fluxo.current?.getTracks().forEach((t) => t.stop()), []);

  const ligar = useCallback(async (): Promise<boolean> => {
    if (!suportaCaminhoA()) {
      setEstado("sem-suporte");
      return false;
    }
    setEstado("a-ligar");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 4096 }, height: { ideal: 3072 } },
        audio: false,
      });
      fluxo.current = stream;
      const capacidades = (stream.getVideoTracks()[0]?.getCapabilities?.() ?? {}) as { torch?: boolean };
      setLuzDisponivel(!!capacidades.torch);
      if (capacidades.torch) await definirLuz(true);
      setEstado("ligada");
      return true;
    } catch (err) {
      const nome = (err as { name?: string } | null)?.name;
      setEstado(nome === "NotAllowedError" || nome === "SecurityError" ? "recusada" : "indisponivel");
      return false;
    }
  }, [definirLuz]);

  // O <video> pode nascer depois de a câmara ligar (a troca de passo é animada):
  // liga-se ao fluxo quando o elemento aparece, e quando o fluxo aparece.
  const ligarAoVideo = (video: HTMLVideoElement | null) => {
    if (!video || !fluxo.current || video.srcObject === fluxo.current) return;
    video.srcObject = fluxo.current;
    video.play().catch(() => {});
  };
  /** Ref para o <video>: `<video ref={refVideo} />`. */
  const refVideo = useCallback((video: HTMLVideoElement | null) => {
    videoRef.current = video;
    ligarAoVideo(video);
  }, []);
  useEffect(() => {
    if (estado === "ligada") ligarAoVideo(videoRef.current);
  }, [estado]);

  /** Uma fotografia em resolução total; se o aparelho não deixar, um fotograma do vídeo. */
  const fotografarUma = useCallback(async (): Promise<ImageBitmap | null> => {
    const t = faixa();
    if (!t) return null;
    if (typeof ImageCapture !== "undefined") {
      try {
        const blob = await new ImageCapture(t).takePhoto();
        // Alguns aparelhos apagam a luz ao fotografar: volta a acendê-la.
        if (luz.current) void definirLuz(true);
        return await createImageBitmap(blob);
      } catch {
        // cai para o fotograma do vídeo
      }
    }
    const v = videoRef.current;
    if (!v || !v.videoWidth) return null;
    return createImageBitmap(v);
  }, [definirLuz]);

  /** Várias fotografias seguidas (a criança fixa pouco tempo: docs §5, ponto 4). */
  const fotografarSequencia = useCallback(
    async (quantas: number, intervaloMs = 350): Promise<ImageBitmap[]> => {
      const fotos: ImageBitmap[] = [];
      for (let i = 0; i < quantas; i++) {
        const f = await fotografarUma();
        if (f) fotos.push(f);
        if (i < quantas - 1) await espera(intervaloMs);
      }
      return fotos;
    },
    [fotografarUma],
  );

  return { refVideo, estado, luzDisponivel, ligar, desligar, fotografarSequencia };
}
