/**
 * O que o teste (Fio de Missangas) e o treino (Vaivém da Missanga) têm em
 * comum no ecrã: o fio ao centro, as marcas de centímetro e a missanga.
 */
import { NARIZ_MM, yDoCm } from "@/lib/visao/fioMissangas";

/**
 * Um computador (rato, sem ecrã de toque): não se encosta ao nariz, e a
 * medida saía sem sentido (caso real, 2026-11-11: 16,8 cm e "sinal a
 * investigar" num portátil). Sem `matchMedia`, deixa fazer.
 */
export const eComputador = (): boolean => {
  try {
    return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  } catch {
    return false;
  }
};

export function desenharFio(
  cv: HTMLCanvasElement,
  g: CanvasRenderingContext2D,
  {
    w,
    h,
    pxPorMm,
    inicioCm,
    cm,
    cor,
    marcaCm,
  }: {
    w: number;
    h: number;
    pxPorMm: number;
    /** Topo do fio (cm a contar do fundo do ecrã). */
    inicioCm: number;
    /** Onde está a missanga. */
    cm: number;
    cor: string;
    /** Um traço no fio (onde ficou a dobrar); `null` = sem traço. */
    marcaCm: number | null;
  },
): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(w * dpr);
  cv.height = Math.round(h * dpr);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, w, h);
  const x = w / 2;
  const narizY = yDoCm(NARIZ_MM / 10, h, pxPorMm);
  // Marcas discretas de centímetro, à direita e sem números (não influenciam a resposta).
  g.strokeStyle = "#dfe7e5";
  g.lineWidth = 1;
  for (let c = 1; yDoCm(c, h, pxPorMm) > 0; c++) {
    const y = yDoCm(c, h, pxPorMm);
    g.beginPath();
    g.moveTo(w, y);
    g.lineTo(w - (c % 5 === 0 ? 22 : 12), y);
    g.stroke();
  }
  g.strokeStyle = "#8a6d4b";
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(x, narizY);
  g.lineTo(x, yDoCm(inicioCm, h, pxPorMm));
  g.stroke();
  if (marcaCm !== null) {
    g.fillStyle = "rgba(178,59,46,0.85)";
    g.fillRect(x - 18, yDoCm(marcaCm, h, pxPorMm) - 1.5, 36, 3);
  }
  const y = yDoCm(cm, h, pxPorMm);
  g.fillStyle = cor;
  g.beginPath();
  g.arc(x, y, 13, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "rgba(255,255,255,0.75)";
  g.beginPath();
  g.arc(x - 4, y - 4, 3.5, 0, Math.PI * 2);
  g.fill();
  // Um pormenor pequeno para os olhos focarem.
  g.fillStyle = "#111111";
  g.beginPath();
  g.arc(x + 3, y + 3, 1.6, 0, Math.PI * 2);
  g.fill();
}
