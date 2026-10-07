import { desvioBinocular, type DesvioBinocular } from "@/lib/rastreio/analise/binocular";
import { paraCinza } from "@/lib/rastreio/analise/imagem";
import { medirOlho, type MedicaoOlho } from "@/lib/rastreio/analise/olho";
import type { Circulo, Ponto } from "@/lib/rastreio/analise/tipos";

/**
 * Ponte entre uma fotografia (no browser) e o motor (puro): recorta a faixa dos
 * olhos, converte-a em cinzento e mede. As posições dos olhos vêm de dois toques
 * na fotografia (na bancada não se usa o detector de rosto: queremos medir o
 * motor, não o detector) ou do detector de rosto (`detectorIris.ts`).
 */

/** Raio da íris ≈ 11,7 mm / 2 ÷ distância entre pupilas (~62 mm) × distância entre toques. */
export const FRACAO_RAIO_POR_DISTANCIA_OLHOS = 11.7 / 2 / 62;

export interface AnaliseFoto {
  larguraFoto: number;
  alturaFoto: number;
  raioAproximadoPx: number;
  olhos: [MedicaoOlho | null, MedicaoOlho | null];
  desvio: DesvioBinocular | null;
  /** Primeiro motivo de falha (olho da esquerda da imagem primeiro), se houver. */
  motivo: string | null;
}

const deslocar = (m: MedicaoOlho, o: Ponto): MedicaoOlho => ({
  ...m,
  reflexo: { x: m.reflexo.x + o.x, y: m.reflexo.y + o.y },
  iris: { centro: { x: m.iris.centro.x + o.x, y: m.iris.centro.y + o.y }, raio: m.iris.raio },
});

/** Íris aproximadas a partir de dois toques (o raio vem da distância entre eles). */
export function irisDosToques(toques: [Ponto, Ponto]): [Circulo, Circulo] {
  const [a, b] = toques[0].x <= toques[1].x ? toques : [toques[1], toques[0]];
  const raio = FRACAO_RAIO_POR_DISTANCIA_OLHOS * Math.hypot(b.x - a.x, b.y - a.y);
  return [{ centro: a, raio }, { centro: b, raio }];
}

export function analisarFoto(foto: ImageBitmap, irisAproximadas: [Circulo, Circulo]): AnaliseFoto {
  const [ia, ib] = irisAproximadas[0].centro.x <= irisAproximadas[1].centro.x ? irisAproximadas : [irisAproximadas[1], irisAproximadas[0]];
  const a = ia.centro;
  const b = ib.centro;
  const raio = Math.max(ia.raio, ib.raio);

  // Faixa dos olhos com margem: evita converter a fotografia inteira (12 MP).
  const margem = 3 * raio;
  const x0 = Math.max(0, Math.floor(Math.min(a.x, b.x) - margem));
  const y0 = Math.max(0, Math.floor(Math.min(a.y, b.y) - margem));
  const x1 = Math.min(foto.width, Math.ceil(Math.max(a.x, b.x) + margem));
  const y1 = Math.min(foto.height, Math.ceil(Math.max(a.y, b.y) + margem));
  const largura = Math.max(1, x1 - x0);
  const altura = Math.max(1, y1 - y0);
  const tela = document.createElement("canvas");
  tela.width = largura;
  tela.height = altura;
  const ctx = tela.getContext("2d", { willReadFrequently: true });
  const base = { larguraFoto: foto.width, alturaFoto: foto.height, raioAproximadoPx: raio };
  if (!ctx) return { ...base, olhos: [null, null], desvio: null, motivo: "canvas-indisponivel" };
  ctx.drawImage(foto, x0, y0, largura, altura, 0, 0, largura, altura);
  const img = paraCinza(ctx.getImageData(0, 0, largura, altura).data, largura, altura);

  const origem = { x: x0, y: y0 };
  const aprox = (c: Circulo): Circulo => ({ centro: { x: c.centro.x - x0, y: c.centro.y - y0 }, raio: c.raio });
  const ma = medirOlho(img, aprox(ia));
  const mb = medirOlho(img, aprox(ib));
  const olhos: [MedicaoOlho | null, MedicaoOlho | null] = [
    ma.ok ? deslocar(ma.valor, origem) : null,
    mb.ok ? deslocar(mb.valor, origem) : null,
  ];
  if (ma.ok === false) return { ...base, olhos, desvio: null, motivo: ma.motivo };
  if (mb.ok === false) return { ...base, olhos, desvio: null, motivo: mb.motivo };
  const d = desvioBinocular(ma.valor, mb.valor);
  return { ...base, olhos, desvio: d.ok === false ? null : d.valor, motivo: d.ok === false ? d.motivo : null };
}
