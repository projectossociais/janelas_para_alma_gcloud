import { geradorAleatorio } from "../geometria";
import type { ImagemCinza, Ponto } from "../tipos";

/**
 * Fotografias sintéticas de olhos, com tudo em posições exactamente
 * conhecidas, para validar o motor (fase V0, docs/MOTOR_ANALISE_RASTREIO.md §8).
 *
 * Desenha pele, abertura do olho (esclera), íris com textura radial, pupila,
 * pálpebra superior, reflexo da luz (saturado, como num sensor real), reflexos
 * extra (óculos) ou difusos (ecrã), desfoque óptico e ruído do sensor. As bordas
 * são suavizadas por sobre-amostragem, para a verdade estar abaixo do píxel.
 */

export interface OlhoSintetico {
  centroIris: Ponto;
  raioIris: number;
  /** Centro do reflexo (absoluto). `null` = sem luz. */
  reflexo: Ponto | null;
  /** Tom da íris (0–255). Íris castanho-escuras: 25–60. */
  tomIris?: number;
  /** Fracção do diâmetro da íris tapada pela pálpebra superior (0–0,45). */
  palpebraSuperior?: number;
  fechado?: boolean;
  reflexosExtra?: Ponto[];
  /** Luz grande e difusa (ex.: ecrã) em vez de uma luz pontual. */
  reflexoDifuso?: boolean;
  /** Reflexos fracos de outras luzes da sala (lâmpadas, janela), abaixo do reflexo principal. */
  reflexosFracos?: Ponto[];
  /** Pestanas da pálpebra superior a cair sobre a íris. */
  pestanas?: boolean;
  /** Largura aparente da íris em relação à altura (olhar de lado: < 1). */
  achatamento?: number;
}

export interface CenaSintetica {
  largura: number;
  altura: number;
  olhos: OlhoSintetico[];
  tomPele?: number;
  tomEsclera?: number;
  /** Desvio-padrão do desfoque óptico, em píxeis. */
  desfoque?: number;
  /** Desvio-padrão do ruído do sensor (0–255). */
  ruido?: number;
  sigmaReflexo?: number;
  semente?: number;
  /** Tremor: arrastamento em píxeis (horizontal se `tremorVertical` for falso). */
  tremor?: number;
  tremorVertical?: boolean;
  /** Exposição: multiplica a luz da cena (pouca luz: < 1). */
  exposicao?: number;
}

const SUB = 3; // sobre-amostragem 3×3 por píxel

function tomNoPonto(x: number, y: number, olho: OlhoSintetico, tomPele: number, tomEsclera: number): number | null {
  const r = olho.raioIris;
  const dx = x - olho.centroIris.x;
  const dy = y - olho.centroIris.y;
  if (olho.fechado) {
    // Pálpebra fechada: pele, com a prega um pouco mais escura.
    return Math.abs(dy) < 1.5 && Math.abs(dx) < 2.2 * r ? tomPele - 40 : null;
  }
  const naAbertura = (dx / (2.3 * r)) ** 2 + (dy / (1.15 * r)) ** 2 <= 1;
  const linhaPalpebra = -r + 2 * r * (olho.palpebraSuperior ?? 0);
  const abaixoDaPalpebra = dy >= linhaPalpebra;
  if (!naAbertura || !abaixoDaPalpebra) return null;
  // Pestanas: riscos escuros finos, inclinados, logo abaixo da pálpebra.
  if (olho.pestanas && dy < linhaPalpebra + 0.18 * r && Math.abs(((dx + 0.4 * (dy - linhaPalpebra)) % 7) + 7) % 7 < 1.2) {
    return 20;
  }
  const e = olho.achatamento ?? 1;
  const d = Math.hypot(dx / e, dy);
  if (d > r) return tomEsclera;
  const tom = olho.tomIris ?? 45;
  if (d < 0.35 * r) return Math.max(8, tom - 25);
  // Textura radial da íris (criptas), simétrica à volta do centro.
  return tom + 6 * Math.sin(14 * Math.atan2(dy, dx)) * (d / r);
}

function desfocar(dados: Float32Array, largura: number, altura: number, sigma: number): Float32Array {
  if (sigma <= 0) return dados;
  const raio = Math.ceil(3 * sigma);
  const nucleo: number[] = [];
  let soma = 0;
  for (let i = -raio; i <= raio; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    nucleo.push(v);
    soma += v;
  }
  const k = nucleo.map((v) => v / soma);
  const tmp = new Float32Array(dados.length);
  const out = new Float32Array(dados.length);
  for (let y = 0; y < altura; y++)
    for (let x = 0; x < largura; x++) {
      let s = 0;
      for (let i = -raio; i <= raio; i++) s += (k[i + raio] ?? 0) * (dados[y * largura + Math.min(largura - 1, Math.max(0, x + i))] ?? 0);
      tmp[y * largura + x] = s;
    }
  for (let y = 0; y < altura; y++)
    for (let x = 0; x < largura; x++) {
      let s = 0;
      for (let i = -raio; i <= raio; i++) s += (k[i + raio] ?? 0) * (tmp[Math.min(altura - 1, Math.max(0, y + i)) * largura + x] ?? 0);
      out[y * largura + x] = s;
    }
  return out;
}

/** Tremor da mão: média ao longo de um segmento (desfoque de movimento). */
function arrastar(dados: Float32Array, largura: number, altura: number, comprimento: number, vertical: boolean): Float32Array {
  const out = new Float32Array(dados.length);
  const n = Math.max(1, Math.round(comprimento));
  for (let y = 0; y < altura; y++)
    for (let x = 0; x < largura; x++) {
      let s = 0;
      for (let k = 0; k < n; k++) {
        const o = k - (n - 1) / 2;
        const xx = vertical ? x : Math.min(largura - 1, Math.max(0, Math.round(x + o)));
        const yy = vertical ? Math.min(altura - 1, Math.max(0, Math.round(y + o))) : y;
        s += dados[yy * largura + xx] ?? 0;
      }
      out[y * largura + x] = s / n;
    }
  return out;
}

export function gerarCena(cena: CenaSintetica): ImagemCinza {
  const { largura, altura, olhos } = cena;
  const tomPele = cena.tomPele ?? 105;
  const tomEsclera = cena.tomEsclera ?? 215;
  const dados = new Float32Array(largura * altura).fill(tomPele);

  for (const olho of olhos) {
    const r = olho.raioIris;
    const x0 = Math.max(0, Math.floor(olho.centroIris.x - 2.4 * r));
    const x1 = Math.min(largura - 1, Math.ceil(olho.centroIris.x + 2.4 * r));
    const y0 = Math.max(0, Math.floor(olho.centroIris.y - 1.3 * r));
    const y1 = Math.min(altura - 1, Math.ceil(olho.centroIris.y + 1.3 * r));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        let s = 0;
        for (let sy = 0; sy < SUB; sy++)
          for (let sx = 0; sx < SUB; sx++) {
            // Centro do píxel (x, y) em coordenadas contínuas é (x, y).
            const px = x - 0.5 + (sx + 0.5) / SUB;
            const py = y - 0.5 + (sy + 0.5) / SUB;
            s += tomNoPonto(px, py, olho, tomPele, tomEsclera) ?? tomPele;
          }
        dados[y * largura + x] = s / (SUB * SUB);
      }
  }

  // Reflexos: intensos (saturam depois do desfoque, como num sensor real).
  const sigmaPonto = cena.sigmaReflexo ?? 1.3;
  const somarMancha = (c: Ponto, sigma: number, amplitude: number) => {
    const raio = Math.ceil(4 * sigma);
    for (let y = Math.max(0, Math.floor(c.y - raio)); y <= Math.min(altura - 1, Math.ceil(c.y + raio)); y++)
      for (let x = Math.max(0, Math.floor(c.x - raio)); x <= Math.min(largura - 1, Math.ceil(c.x + raio)); x++) {
        const d2 = (x - c.x) ** 2 + (y - c.y) ** 2;
        dados[y * largura + x]! += amplitude * Math.exp(-d2 / (2 * sigma * sigma));
      }
  };
  for (const olho of olhos) {
    if (olho.fechado || !olho.reflexo) continue;
    if (olho.reflexoDifuso) somarMancha(olho.reflexo, 0.3 * olho.raioIris, 190);
    else somarMancha(olho.reflexo, sigmaPonto, 420);
    for (const extra of olho.reflexosExtra ?? []) somarMancha(extra, sigmaPonto, 420);
    for (const fraco of olho.reflexosFracos ?? []) somarMancha(fraco, sigmaPonto, 90);
  }
  if (cena.exposicao !== undefined) for (let i = 0; i < dados.length; i++) dados[i]! *= cena.exposicao;

  let desfocado = desfocar(dados, largura, altura, cena.desfoque ?? 1);
  if (cena.tremor && cena.tremor > 0) desfocado = arrastar(desfocado, largura, altura, cena.tremor, !!cena.tremorVertical);
  const aleatorio = geradorAleatorio(cena.semente ?? 1);
  const sigmaRuido = cena.ruido ?? 3;
  for (let i = 0; i < desfocado.length; i++) {
    // Box–Muller: ruído gaussiano reprodutível.
    const u = Math.max(1e-12, aleatorio());
    const ruido = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * aleatorio()) * sigmaRuido;
    desfocado[i] = Math.min(255, Math.max(0, (desfocado[i] ?? 0) + ruido));
  }
  return { largura, altura, dados: desfocado };
}
