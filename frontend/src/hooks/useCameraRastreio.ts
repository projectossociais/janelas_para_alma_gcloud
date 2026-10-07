import { useCallback, useEffect, useRef, useState } from "react";
import { LUMINANCIA_MINIMA, luminanciaMedia } from "@/lib/rastreio/rastreio";

/**
 * A câmara do rastreio: ligar, desligar, fotografar, e os dois sinais reais
 * que decidem se se pode fotografar agora (luz e rosto). Nenhum sinal é
 * simulado: a luz mede-se na imagem, o rosto vem do detector (MediaPipe).
 *
 * O detector vem de um servidor externo. Se não responder em
 * `ESPERA_DETECTOR` ms, o rosto deixa de bloquear a fotografia: a análise no
 * servidor faz a verificação final (`rosto_detetado`). Nunca bloquear para
 * sempre por uma dependência que pode falhar.
 */
export type EstadoCamera = "desligada" | "a-ligar" | "ligada" | "recusada" | "indisponivel" | "sem-suporte";

const INTERVALO_LUZ = 700;
export const ESPERA_DETECTOR = 5000;

export function useCameraRastreio() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fluxo = useRef<MediaStream | null>(null);
  const tela = useRef<HTMLCanvasElement | null>(null);
  const ultimoRosto = useRef<boolean | null>(null);

  const [estado, setEstado] = useState<EstadoCamera>("desligada");
  const [escuro, setEscuro] = useState(false);
  const [rostoVisivel, setRostoVisivel] = useState(false);
  const [detectorPronto, setDetectorPronto] = useState(false);
  const [detectorFalhou, setDetectorFalhou] = useState(false);

  const desligar = useCallback(() => {
    fluxo.current?.getTracks().forEach((t) => t.stop());
    fluxo.current = null;
    ultimoRosto.current = null;
    setEstado("desligada");
    setEscuro(false);
    setRostoVisivel(false);
    setDetectorPronto(false);
    setDetectorFalhou(false);
  }, []);

  // A câmara desliga-se sempre ao sair do ecrã.
  useEffect(() => () => fluxo.current?.getTracks().forEach((t) => t.stop()), []);

  const ligar = useCallback(async (): Promise<boolean> => {
    // Sem página segura (ex.: http por IP da rede) ou sem API de câmara, o browser
    // nem deixa pedir: diz-se isso, em vez de "outra aplicação está a usá-la".
    if (window.isSecureContext === false || !navigator.mediaDevices?.getUserMedia) {
      setEstado("sem-suporte");
      return false;
    }
    setEstado("a-ligar");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      fluxo.current = stream;
      setEstado("ligada");
      return true;
    } catch (err) {
      const nome = (err as { name?: string } | null)?.name;
      setEstado(nome === "NotAllowedError" || nome === "SecurityError" ? "recusada" : "indisponivel");
      return false;
    }
  }, []);

  // O <video> pode nascer depois de a câmara ligar (a troca de passo é
  // animada): liga-se ao fluxo quando o elemento aparece, e também quando o
  // fluxo aparece com o elemento já presente.
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

  const lerLuz = useCallback((): number | null => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return null;
    const canvas = (tela.current ??= document.createElement("canvas"));
    const w = 64;
    const h = Math.max(1, Math.round((video.videoHeight || 480) * (w / (video.videoWidth || 640))));
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    try {
      ctx.drawImage(video, 0, 0, w, h);
      return luminanciaMedia(ctx.getImageData(0, 0, w, h).data);
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (estado !== "ligada") return;
    const id = window.setInterval(() => {
      const luz = lerLuz();
      if (luz !== null) setEscuro(luz < LUMINANCIA_MINIMA);
    }, INTERVALO_LUZ);
    return () => window.clearInterval(id);
  }, [estado, lerLuz]);

  // Se o detector não der sinal de vida, deixa de bloquear.
  useEffect(() => {
    if (estado !== "ligada" || detectorPronto) return;
    const id = window.setTimeout(() => setDetectorFalhou(true), ESPERA_DETECTOR);
    return () => window.clearTimeout(id);
  }, [estado, detectorPronto]);

  /** Chamado pelo detector a cada imagem; só muda o estado quando muda. */
  const aoDetectar = useCallback((encontrou: boolean) => {
    setDetectorPronto(true);
    if (ultimoRosto.current === encontrou) return;
    ultimoRosto.current = encontrou;
    setRostoVisivel(encontrou);
  }, []);

  /** A imagem actual, em JPEG (data URL). `null` se não houver vídeo. */
  const fotografar = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return null;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 960;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.9);
  }, []);

  const rostoOk = rostoVisivel || detectorFalhou;
  const podeFotografar = estado === "ligada" && !escuro && rostoOk;

  return { videoRef, refVideo, estado, escuro, rostoVisivel, rostoOk, podeFotografar, ligar, desligar, fotografar, aoDetectar };
}
