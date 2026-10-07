import { irisDosMarcos, type MarcoNormalizado } from "./analise/marcos";
import { localizarFicheiroFaceMesh } from "./ficheirosFaceMesh";
import type { Circulo } from "./analise/tipos";

/**
 * Detector das íris numa fotografia, com o FaceMesh do MediaPipe a correr no
 * próprio telemóvel (a fotografia não sai dele; os ficheiros do modelo vêm do
 * próprio site, `ficheirosFaceMesh.ts`). Uma instância por página, reutilizada.
 *
 * Devolve as posições aproximadas das duas íris, ou `null` se não houver cara,
 * o modelo não carregar, ou demorar mais do que `ESPERA_MAXIMA_MS`.
 */

export const ESPERA_MAXIMA_MS = 20_000;
/** O modelo reduz a cara internamente; uma imagem maior só o torna mais lento. */
const LADO_MAXIMO_ENTRADA = 1920;

interface ResultadosFaceMesh {
  multiFaceLandmarks?: MarcoNormalizado[][];
}
interface FaceMeshLike {
  setOptions(o: Record<string, unknown>): void;
  onResults(f: (r: ResultadosFaceMesh) => void): void;
  send(i: { image: HTMLCanvasElement }): Promise<void>;
}

let instancia: Promise<FaceMeshLike | null> | null = null;
let aoResultado: ((r: ResultadosFaceMesh) => void) | null = null;

function carregar(): Promise<FaceMeshLike | null> {
  instancia ??= (async () => {
    try {
      const mod = (await import("@mediapipe/face_mesh")) as unknown as { FaceMesh?: new (o: object) => FaceMeshLike };
      const Construtor = mod.FaceMesh ?? (window as unknown as { FaceMesh?: new (o: object) => FaceMeshLike }).FaceMesh;
      if (!Construtor) return null;
      const fm = new Construtor({
        locateFile: localizarFicheiroFaceMesh,
      });
      fm.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
      fm.onResults((r) => aoResultado?.(r));
      return fm;
    } catch {
      instancia = null; // deixa tentar de novo da próxima vez
      return null;
    }
  })();
  return instancia;
}

export async function detectarIris(foto: ImageBitmap): Promise<[Circulo, Circulo] | null> {
  const fm = await carregar();
  if (!fm) return null;
  const escala = Math.min(1, LADO_MAXIMO_ENTRADA / Math.max(foto.width, foto.height));
  const tela = document.createElement("canvas");
  tela.width = Math.round(foto.width * escala);
  tela.height = Math.round(foto.height * escala);
  tela.getContext("2d")?.drawImage(foto, 0, 0, tela.width, tela.height);

  const resultado = new Promise<ResultadosFaceMesh | null>((resolver) => {
    const limite = window.setTimeout(() => resolver(null), ESPERA_MAXIMA_MS);
    aoResultado = (r) => {
      window.clearTimeout(limite);
      resolver(r);
    };
  });
  try {
    await fm.send({ image: tela });
  } catch {
    return null;
  }
  const r = await resultado;
  aoResultado = null;
  const marcos = r?.multiFaceLandmarks?.[0];
  // Marcos normalizados (0–1): convertem-se para a fotografia original, não para a reduzida.
  return marcos ? irisDosMarcos(marcos, foto.width, foto.height) : null;
}
