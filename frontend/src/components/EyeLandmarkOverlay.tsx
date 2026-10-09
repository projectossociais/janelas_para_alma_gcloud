import { useEffect, useRef, type RefObject } from "react";

/**
 * Discreet real-time eye landmark overlay powered by MediaPipe FaceMesh.
 * Draws small green dots on the eye corners and the pupil (iris) centers only.
 */

// FaceMesh landmark indices
const EYE_CORNERS = [33, 133, 362, 263]; // outer/inner corners of both eyes
const IRIS_CENTERS = [468, 473]; // requires refineLandmarks

interface Props {
  videoRef: RefObject<HTMLVideoElement>;
  active: boolean;
  onLandmarks?: (found: boolean) => void;
  /** Receives the latest raw FaceMesh landmarks for the detected face (read-only mirror). */
  landmarksRef?: { current: Array<{ x: number; y: number; z?: number }> | null };
}

const EyeLandmarkOverlay = ({ videoRef, active, onLandmarks, landmarksRef }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let faceMesh: any = null;

    const draw = (results: { multiFaceLandmarks?: Array<Array<{ x: number; y: number }>> }) => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;
      const w = video.clientWidth;
      const h = video.clientHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);

      const face = results.multiFaceLandmarks?.[0];
      onLandmarks?.(!!face);
      if (landmarksRef) landmarksRef.current = face ?? null;
      if (!face) return;

      // The video uses object-cover + mirrored preview; compute cover mapping.
      const vw = video.videoWidth || w;
      const vh = video.videoHeight || h;
      const scale = Math.max(w / vw, h / vh);
      const dw = vw * scale;
      const dh = vh * scale;
      const ox = (w - dw) / 2;
      const oy = (h - dh) / 2;

      const point = (i: number, radius: number) => {
        const lm = face[i];
        if (!lm) return;
        const x = ox + lm.x * dw;
        const y = oy + lm.y * dh;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(52, 211, 153, 0.95)";
        ctx.shadowColor = "rgba(52, 211, 153, 0.9)";
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
      };

      EYE_CORNERS.forEach((i) => point(i, 2));
      IRIS_CENTERS.forEach((i) => point(i, 3));
    };

    (async () => {
      const mod = await import("@mediapipe/face_mesh");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const FaceMeshCtor = (mod as any).FaceMesh ?? (window as any).FaceMesh;
      if (cancelled || !FaceMeshCtor) return;

      faceMesh = new FaceMeshCtor({
        locateFile: (file: string) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${file}`,
      });
      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true, // enables iris landmarks (468+)
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      faceMesh.onResults(draw);

      const loop = async () => {
        if (cancelled) return;
        const video = videoRef.current;
        if (video && video.readyState >= 2) {
          try {
            await faceMesh.send({ image: video });
          } catch {
            /* ignore transient frame errors */
          }
        }
        rafRef.current = requestAnimationFrame(() => void loop());
      };
      void loop();
    })();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      try {
        faceMesh?.close?.();
      } catch {
        /* noop */
      }
    };
  }, [active, videoRef, onLandmarks, landmarksRef]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  );
};

export default EyeLandmarkOverlay;
