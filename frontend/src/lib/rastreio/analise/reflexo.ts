import { percentil, valor } from "./imagem";
import { falha, sucesso, type Circulo, type ImagemCinza, type Ponto, type Resultado } from "./tipos";

/**
 * Reflexo da luz na córnea (primeira imagem de Purkinje), dentro da íris.
 *
 * Uma luz pontual (a luz do telemóvel) cria na córnea uma mancha pequena e muito
 * mais brilhante do que a íris à volta. O centro mede-se pela média das posições
 * pesada pelo brilho, o que dá precisão abaixo do píxel.
 */

/** Diferença mínima entre o pico e a íris para haver reflexo (0–255). */
export const CONTRASTE_MINIMO_REFLEXO = 60;
/** Procura-se até esta fracção do raio aproximado da íris. */
export const FRACAO_RAIO_PROCURA = 0.75;
/** Área máxima de um reflexo pontual, em fracção da área da íris. */
export const FRACAO_AREA_MAXIMA = 0.04;
/** Outra mancha com pelo menos esta fracção do brilho do reflexo conta como reflexo. */
export const FRACAO_BRILHO_CONCORRENTE = 0.8;

export type MotivoFalhaReflexo = "sem-reflexo" | "reflexos-multiplos" | "reflexo-difuso";

export interface Reflexo {
  centro: Ponto;
  /** Área da mancha, em píxeis. */
  area: number;
  /** Pico menos o fundo da íris (0–255). */
  contraste: number;
  /** Índices (na imagem) dos píxeis da mancha, para a tapar antes de ajustar o limbo. */
  pixeis: number[];
}

interface Mancha {
  pixeis: number[];
  pico: number;
  tocaBorda: boolean;
}

export function localizarReflexo(img: ImagemCinza, aprox: Circulo): Resultado<Reflexo, MotivoFalhaReflexo> {
  const raio = FRACAO_RAIO_PROCURA * aprox.raio;
  const { x: cx, y: cy } = aprox.centro;
  const x0 = Math.max(0, Math.floor(cx - raio));
  const x1 = Math.min(img.largura - 1, Math.ceil(cx + raio));
  const y0 = Math.max(0, Math.floor(cy - raio));
  const y1 = Math.min(img.altura - 1, Math.ceil(cy + raio));
  const dentro = (x: number, y: number) => (x - cx) ** 2 + (y - cy) ** 2 <= raio * raio;

  const valores: number[] = [];
  let pico = -Infinity;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++)
      if (dentro(x, y)) {
        const v = valor(img, x, y);
        valores.push(v);
        if (v > pico) pico = v;
      }
  if (valores.length === 0) return falha("sem-reflexo");

  // Fundo = tom da íris. Um percentil baixo, não a mediana: uma luz difusa
  // (ecrã, janela) pode cobrir metade da íris e puxaria a mediana para cima, e
  // o seu centro passaria por um reflexo pontual (apanhado pelos testes).
  const fundo = percentil(valores, 0.25);
  const contraste = pico - fundo;
  if (contraste < CONTRASTE_MINIMO_REFLEXO) return falha("sem-reflexo");
  const limiar = fundo + 0.5 * contraste;

  // Manchas (4-conectadas) acima do limiar, dentro do círculo de procura.
  const visto = new Uint8Array(img.largura * img.altura);
  const manchas: Mancha[] = [];
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const i = y * img.largura + x;
      if (visto[i] || !dentro(x, y) || (img.dados[i] ?? 0) < limiar) continue;
      const mancha: Mancha = { pixeis: [], pico: -Infinity, tocaBorda: false };
      const pilha = [i];
      visto[i] = 1;
      while (pilha.length) {
        const k = pilha.pop()!;
        const kx = k % img.largura;
        const ky = (k - kx) / img.largura;
        const v = img.dados[k] ?? 0;
        mancha.pixeis.push(k);
        if (v > mancha.pico) mancha.pico = v;
        for (const [nx, ny] of [[kx + 1, ky], [kx - 1, ky], [kx, ky + 1], [kx, ky - 1]] as const) {
          if (nx < 0 || ny < 0 || nx >= img.largura || ny >= img.altura) continue;
          const n = ny * img.largura + nx;
          if (visto[n] || (img.dados[n] ?? 0) < limiar) continue;
          if (!dentro(nx, ny)) {
            // A mancha continua para fora da área de procura: é esclera ou pálpebra.
            mancha.tocaBorda = true;
            continue;
          }
          visto[n] = 1;
          pilha.push(n);
        }
      }
      manchas.push(mancha);
    }

  // Um reflexo pontual é sempre a mancha mais brilhante dentro da íris. Se a
  // mais brilhante for grande, a luz é difusa (ecrã, janela) e nenhuma mancha
  // pequena à volta serve: a fronteira da pupila debaixo de uma luz difusa
  // cria um anel fino que passaria por reflexo (apanhado pelos testes).
  const areaMaxima = FRACAO_AREA_MAXIMA * Math.PI * aprox.raio * aprox.raio;
  const interiores = manchas.filter((m) => !m.tocaBorda).sort((a, b) => b.pico - a.pico);
  const principal = interiores[0];
  if (!principal) return falha("sem-reflexo");
  if (principal.pixeis.length > areaMaxima) return falha("reflexo-difuso");
  const concorrentes = interiores.slice(1).filter((m) => m.pico >= FRACAO_BRILHO_CONCORRENTE * principal.pico);
  if (concorrentes.length > 0) return falha("reflexos-multiplos");

  // Centro pesado pelo brilho acima do fundo.
  let sp = 0, sx = 0, sy = 0;
  for (const k of principal.pixeis) {
    const kx = k % img.largura;
    const ky = (k - kx) / img.largura;
    const p = (img.dados[k] ?? 0) - fundo;
    sp += p; sx += p * kx; sy += p * ky;
  }
  return sucesso({
    centro: { x: sx / sp, y: sy / sp },
    area: principal.pixeis.length,
    contraste,
    pixeis: principal.pixeis,
  });
}
