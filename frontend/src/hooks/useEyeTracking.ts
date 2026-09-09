import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

/**
 * Hook de eye tracking baseado no MediaPipe FaceMesh (mesmo modelo usado em
 * `EyeLandmarkOverlay.tsx`/`Scanner.tsx`). Estima a direcção do olhar a
 * partir da posição da íris dentro do rectângulo do olho (landmarks de
 * refinamento 468/473) e expõe uma calibração simples que recentra essa
 * estimativa na posição actual do utilizador.
 */

export interface GazePoint {
  x: number;
  y: number;
}

export interface UseEyeTrackingResult {
  /** Acoplar ao elemento <video> que recebe o stream da webcam. */
  videoRef: RefObject<HTMLVideoElement>;
  /** Coordenadas normalizadas (0 a 1) do olhar, já ajustadas pela calibração. */
  gaze: GazePoint;
  /** true enquanto o rosto/olhos estiverem visíveis e a ser processados. */
  isTracking: boolean;
  /** true durante a janela de recolha de amostras do calibrate(). */
  isCalibrating: boolean;
  /** Recalcula o offset central com base no olhar actual do utilizador. */
  calibrate: () => Promise<void>;
  /** Mensagem de erro amigável (permissão/câmara indisponível), ou null. */
  error: string | null;
}

interface FaceMeshLandmark {
  x: number;
  y: number;
  z?: number;
}

interface FaceMeshResults {
  multiFaceLandmarks?: FaceMeshLandmark[][];
}

interface FaceMeshInstance {
  setOptions: (options: Record<string, unknown>) => void;
  onResults: (callback: (results: FaceMeshResults) => void) => void;
  send: (input: { image: HTMLVideoElement }) => Promise<void>;
  close?: () => void;
}

// Índices de landmarks do FaceMesh (com refineLandmarks activo).
const EYE_A = { outer: 33, inner: 133, top: 159, bottom: 145, iris: 468 };
const EYE_B = { outer: 362, inner: 263, top: 386, bottom: 374, iris: 473 };

// Duração total da calibração e "warm-up" inicial descartado (dá tempo à
// EMA de convergir depois do reset em calibrate(), antes de começar a
// contar amostras para a média).
const CALIBRATION_DURATION_MS = 800;
const CALIBRATION_WARMUP_MS = 200;
// Fracção de amostras (as mais distantes da média) descartada antes de
// calcular o offset final -- evita que uma piscadela ou uma perda breve de
// tracking durante a calibração distorça o centro calculado.
const CALIBRATION_TRIM_RATIO = 0.2;

// Ganhos empíricos: a íris move-se apenas numa faixa estreita (~0.35-0.65)
// dentro do rectângulo do olho, por isso é preciso amplificar essa faixa
// para ocupar o intervalo 0-1 completo. Vertical > horizontal porque a
// abertura do olho é mais estreita que a sua largura. Reforçados face à
// primeira versão -- o cursor ficava aquém das bordas do ecrã mesmo a olhar
// para os extremos; o clamp01 na aplicação do ganho continua a garantir que
// nunca ultrapassa o intervalo 0-1.
const GAZE_GAIN_X = 7;
const GAZE_GAIN_Y = 10;

// Média Móvel Exponencial "dinâmica" aplicada à posição da íris ANTES do
// ganho acima -- suavizar depois do ganho amplificaria o tremor em vez de o
// reduzir. Um alpha fixo é sempre um compromisso: baixo o suficiente para
// segurar o tremor da câmara quando o olhar está parado, mas então
// demasiado lento a seguir um movimento intencional (o cursor "arrasta-se"
// atrás do alvo). Em vez de um valor fixo, o alpha varia com a distância
// entre a amostra crua actual e a posição suavizada anterior: distâncias
// minúsculas (ruído, olhar fixo) usam ALPHA_MIN -- cursor muito estável;
// distâncias maiores (sacada/movimento intencional) usam ALPHA_MAX --
// cursor responde quase de imediato. Entre os dois limiares, interpola
// linearmente para não haver um "salto" abrupto de comportamento.
const DYNAMIC_ALPHA_MIN = 0.05;
const DYNAMIC_ALPHA_MAX = 0.3;
const DYNAMIC_ALPHA_DIST_LOW = 0.008;
const DYNAMIC_ALPHA_DIST_HIGH = 0.04;

// Filtro de outliers, aplicado ANTES da EMA acima. Uma piscadela ou a
// câmara a perder a íris por um único frame pode devolver uma posição
// absurda (ex.: a íris "salta" para um canto do olho, perto de 0 ou 1).
// Dois testes independentes, qualquer um chega para rejeitar o frame por
// completo (mantém-se a última posição suavizada, sem tocar no EMA):
//  1. Distância: fisicamente, o olhar não se desloca 10% do intervalo
//     possível num único frame.
//  2. Valor absoluto: um valor isolado perto de 0 ou 1 já é implausível
//     por si só, mesmo que por coincidência não pareça um salto grande
//     em relação ao frame anterior (ex.: dois frames seguidos com perda
//     de tracking).
const OUTLIER_MAX_DIST = 0.1;
const OUTLIER_EXTREME_MARGIN = 0.15;
const isOutlierExtremo = (v: number) => v < OUTLIER_EXTREME_MARGIN || v > 1 - OUTLIER_EXTREME_MARGIN;

const dynamicAlpha = (distancia: number): number => {
  if (distancia <= DYNAMIC_ALPHA_DIST_LOW) return DYNAMIC_ALPHA_MIN;
  if (distancia >= DYNAMIC_ALPHA_DIST_HIGH) return DYNAMIC_ALPHA_MAX;
  const proporcao =
    (distancia - DYNAMIC_ALPHA_DIST_LOW) / (DYNAMIC_ALPHA_DIST_HIGH - DYNAMIC_ALPHA_DIST_LOW);
  return DYNAMIC_ALPHA_MIN + proporcao * (DYNAMIC_ALPHA_MAX - DYNAMIC_ALPHA_MIN);
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const mean = (points: GazePoint[]): GazePoint => ({
  x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
  y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
});

/** Média do olhar recolhido durante a calibração, aparando as amostras mais
 * distantes do centro (piscadelas, perdas de tracking momentâneas). */
const trimmedAverage = (samples: GazePoint[]): GazePoint => {
  if (samples.length < 5) return mean(samples);

  const centro = mean(samples);
  const porDistancia = samples
    .map((p) => ({ p, dist: Math.hypot(p.x - centro.x, p.y - centro.y) }))
    .sort((a, b) => a.dist - b.dist);
  const manterAte = Math.max(1, Math.round(porDistancia.length * (1 - CALIBRATION_TRIM_RATIO)));
  return mean(porDistancia.slice(0, manterAte).map((entry) => entry.p));
};

const eyeGazeRatio = (
  landmarks: FaceMeshLandmark[],
  eye: typeof EYE_A,
): GazePoint | null => {
  const outer = landmarks[eye.outer];
  const inner = landmarks[eye.inner];
  const top = landmarks[eye.top];
  const bottom = landmarks[eye.bottom];
  const iris = landmarks[eye.iris];
  if (!outer || !inner || !top || !bottom || !iris) return null;

  const minX = Math.min(outer.x, inner.x);
  const maxX = Math.max(outer.x, inner.x);
  const minY = Math.min(top.y, bottom.y);
  const maxY = Math.max(top.y, bottom.y);
  const width = maxX - minX;
  const height = maxY - minY;
  if (width <= 0 || height <= 0) return null;

  return {
    x: (iris.x - minX) / width,
    y: (iris.y - minY) / height,
  };
};

export function useEyeTracking(): UseEyeTrackingResult {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const faceMeshRef = useRef<FaceMeshInstance | null>(null);
  const rafRef = useRef<number | null>(null);
  /** Última posição da íris já suavizada pela EMA (pré-ganho, pré-offset). */
  const smoothedGazeRef = useRef<GazePoint | null>(null);
  const calibrationOffsetRef = useRef<GazePoint>({ x: 0.5, y: 0.5 });

  const [gaze, setGaze] = useState<GazePoint>({ x: 0.5, y: 0.5 });
  const [isTracking, setIsTracking] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const handleResults = (results: FaceMeshResults) => {
      const landmarks = results.multiFaceLandmarks?.[0];
      const a = landmarks && eyeGazeRatio(landmarks, EYE_A);
      const b = landmarks && eyeGazeRatio(landmarks, EYE_B);
      if (!landmarks || !a || !b) {
        setIsTracking(false);
        return;
      }

      const raw = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

      if (isOutlierExtremo(raw.x) || isOutlierExtremo(raw.y)) {
        // Valor absoluto implausível (perto de 0 ou 1) -- provavelmente uma
        // piscadela. Ignora por completo: o cursor congela na última
        // posição em vez de saltar para um canto do ecrã.
        setIsTracking(true);
        return;
      }

      const prev = smoothedGazeRef.current;
      let smoothed: GazePoint;
      if (prev) {
        const distancia = Math.hypot(raw.x - prev.x, raw.y - prev.y);
        if (distancia > OUTLIER_MAX_DIST) {
          // Salto brusco em relação ao frame anterior -- provavelmente uma
          // piscadela ou perda momentânea da íris. Ignora este frame por
          // completo: não mexe no EMA nem no gaze reportado, mantém tudo na
          // última posição válida (o cursor "congela" e só retoma quando o
          // olho voltar a ser detectado de forma plausível).
          setIsTracking(true);
          return;
        }
        const alpha = dynamicAlpha(distancia);
        smoothed = {
          x: alpha * raw.x + (1 - alpha) * prev.x,
          y: alpha * raw.y + (1 - alpha) * prev.y,
        };
      } else {
        smoothed = raw;
      }
      smoothedGazeRef.current = smoothed;
      setIsTracking(true);

      const offset = calibrationOffsetRef.current;
      setGaze({
        x: clamp01(0.5 + (smoothed.x - offset.x) * GAZE_GAIN_X),
        y: clamp01(0.5 + (smoothed.y - offset.y) * GAZE_GAIN_Y),
      });
    };

    const startFaceMesh = async () => {
      const mod = await import("@mediapipe/face_mesh");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const FaceMeshCtor = (mod as any).FaceMesh ?? (window as any).FaceMesh;
      if (cancelled || !FaceMeshCtor) return;

      const faceMesh: FaceMeshInstance = new FaceMeshCtor({
        locateFile: (file: string) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${file}`,
      });
      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      faceMesh.onResults(handleResults);
      faceMeshRef.current = faceMesh;

      const loop = async () => {
        if (cancelled) return;
        const video = videoRef.current;
        if (video && video.readyState >= 2) {
          try {
            await faceMesh.send({ image: video });
          } catch {
            /* ignora frames transitórios inválidos */
          }
        }
        rafRef.current = requestAnimationFrame(() => void loop());
      };
      void loop();
    };

    const startCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Câmara não suportada neste navegador.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
        if (cancelled) {
          // Desmontou (ou foi cancelado) enquanto a permissão estava
          // pendente -- fecha o stream para não deixar a luz da câmara acesa.
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        await startFaceMesh();
      } catch {
        if (!cancelled) setError("Não foi possível aceder à câmara.");
      }
    };

    void startCamera();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      try {
        faceMeshRef.current?.close?.();
      } catch {
        /* noop */
      }
      faceMeshRef.current = null;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  const calibrate = useCallback(() => {
    return new Promise<void>((resolve) => {
      setIsCalibrating(true);
      // Recomeça a EMA do zero: sem isto, as primeiras amostras ainda
      // arrastariam o valor suavizado de antes da calibração começar (ex.:
      // se o utilizador olhava para outro lado um instante antes).
      smoothedGazeRef.current = null;
      const samples: GazePoint[] = [];
      const startedAt = performance.now();

      const collect = () => {
        const elapsed = performance.now() - startedAt;
        // Descarta o "warm-up": logo a seguir ao reset, a EMA está a
        // convergir a partir da primeira amostra crua, ainda não estável.
        if (elapsed >= CALIBRATION_WARMUP_MS && smoothedGazeRef.current) {
          samples.push(smoothedGazeRef.current);
        }
        if (elapsed < CALIBRATION_DURATION_MS) {
          requestAnimationFrame(collect);
          return;
        }
        if (samples.length > 0) {
          calibrationOffsetRef.current = trimmedAverage(samples);
        }
        setIsCalibrating(false);
        resolve();
      };

      requestAnimationFrame(collect);
    });
  }, []);

  return { videoRef, gaze, isTracking, isCalibrating, calibrate, error };
}
