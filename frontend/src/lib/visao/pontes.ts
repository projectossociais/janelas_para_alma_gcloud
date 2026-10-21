/**
 * Pontes de Fusão: amplitudes de vergência fusional medidas em casa, em
 * dioptrias prismáticas (Δ) -- a unidade da régua de prismas do consultório.
 *
 * Dois anéis, um por olho (óculos vermelho-ciano: vermelho = olho esquerdo).
 * Afastá-los no ecrã pede aos olhos que convirjam (imagem do olho esquerdo à
 * direita: disparidade cruzada, como um prisma de base externa) ou que
 * divirjam (ao contrário, base interna), sem mudar a focagem, que fica no
 * ecrã. A procura de vergência é, em Δ:
 *
 *   Δ = 100 · tan(ângulo) ≈ 100 · s / D
 *
 * com s a separação entre as duas imagens no ecrã e D a distância aos olhos
 * (medida pelo ponto cego, Régua Invisível).
 *
 * O que torna a medida objectiva: dentro dos anéis há um estereograma de
 * pontos aleatórios com uma forma que **só se vê com os anéis fundidos**.
 * Cada olho sozinho só vê ruído; com visão dupla ou um olho suprimido, a
 * forma não existe. A pessoa escolhe a forma entre quatro -- deixa de ser
 * "vejo 1 / vejo 2". Quem não vê a forma com os anéis sobrepostos (0 Δ) não
 * tem a visão 3D grosseira de que o exercício precisa, e é avisado disso.
 *
 * Funções puras -- o desenho no ecrã vive em `pages/exercises/PontesFusao.tsx`.
 */

import { coresEstereograma, type Rgb } from "./anaglifo";
import { gerarPares, type Forma } from "./estereograma";
import type { Rng } from "./escada";

export type Sentido = "convergencia" | "divergencia";
export const SENTIDOS: readonly Sentido[] = ["convergencia", "divergencia"];

/** Diâmetro exterior de cada anel, no ecrã. */
export const DIAMETRO_PONTE_MM = 30;
/** Espessura do anel (o estímulo de fusão periférico à volta do estereograma). */
export const ESPESSURA_ANEL_MM = 1.5;
/** Folga de cada lado entre as imagens e a borda do palco. */
export const MARGEM_PALCO_MM = 4;
/**
 * Disparidade da forma escondida: grosseira de propósito (~0,28°), para medir
 * a fusão e não a acuidade estereoscópica. Uma ligeira disparidade de fixação
 * não a esconde; a visão dupla esconde.
 */
export const DISPARIDADE_FORMA_ARCSEG = 1000;
/** Lado de cada ponto aleatório, no ecrã. */
export const PONTO_MM = 0.5;

/**
 * Degraus de procura, em Δ. Em perto, a rotura de convergência anda pelos
 * 19 Δ e a de divergência pelos 13 Δ nos adultos sem queixas (normas de
 * Morgan); os degraus vão para lá disso, até onde o ecrã deixar.
 */
export const NIVEIS_DELTA: Readonly<Record<Sentido, readonly number[]>> = {
  convergencia: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 31, 35, 40],
  divergencia: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 25],
};

/** Erros seguidos que marcam a rotura (a fusão perdeu-se). */
export const ERROS_PARA_ROTURA = 2;
/** Acertos seguidos no mesmo degrau que marcam a recuperação. */
export const ACERTOS_PARA_RECUPERACAO = 2;
/** Na verificação inicial (0 Δ), quantas certas em quantas. */
export const VERIFICACAO_TENTATIVAS = 3;
export const VERIFICACAO_CERTAS = 2;

/** Separação entre as duas imagens no ecrã (mm) para uma procura em Δ. */
export const separacaoMm = (delta: number, distanciaMm: number): number => (delta * distanciaMm) / 100;

/** Procura em Δ de uma separação no ecrã (mm). */
export const deltaDaSeparacao = (separacao: number, distanciaMm: number): number => (100 * separacao) / distanciaMm;

/** Degraus que cabem num palco com esta largura (mm), a esta distância. */
export const niveisMostraveis = (niveis: readonly number[], distanciaMm: number, larguraPalcoMm: number): number[] =>
  niveis.filter((d) => separacaoMm(d, distanciaMm) + DIAMETRO_PONTE_MM + 2 * MARGEM_PALCO_MM <= larguraPalcoMm);

// --- Escada de rotura e recuperação -----------------------------------------

export interface EstadoRampa {
  total: number;
  indice: number;
  fase: "subir" | "descer";
  errosSeguidos: number;
  acertosSeguidos: number;
  /** Índice do degrau em que a fusão se perdeu; `null` se nunca se perdeu. */
  rotura: number | null;
  /** Índice do degrau em que a fusão voltou; `null` se não voltou. */
  recuperacao: number | null;
  /** Passou o degrau mais alto que o ecrã consegue mostrar sem perder a fusão. */
  atingiuLimite: boolean;
  terminado: boolean;
}

export function iniciarRampa(total: number): EstadoRampa {
  if (total < 2) throw new Error("rampa sem degraus suficientes"); // erro interno, nunca chega ao ecrã
  return {
    total,
    indice: 0,
    fase: "subir",
    errosSeguidos: 0,
    acertosSeguidos: 0,
    rotura: null,
    recuperacao: null,
    atingiuLimite: false,
    terminado: false,
  };
}

/**
 * Uma resposta. A subir: certa -> degrau seguinte; `ERROS_PARA_ROTURA`
 * erradas seguidas -> rotura nesse degrau, e começa a descer. A descer:
 * `ACERTOS_PARA_RECUPERACAO` certas seguidas -> recuperação nesse degrau;
 * errada -> desce mais um. Uma certa ao acaso tem 1 em 4 de probabilidade;
 * por isso a recuperação pede duas seguidas.
 */
export function responderRampa(e: EstadoRampa, acertou: boolean): EstadoRampa {
  if (e.terminado) return e;
  if (e.fase === "subir") {
    if (acertou) {
      if (e.indice >= e.total - 1) return { ...e, errosSeguidos: 0, atingiuLimite: true, terminado: true };
      return { ...e, indice: e.indice + 1, errosSeguidos: 0 };
    }
    const erros = e.errosSeguidos + 1;
    if (erros < ERROS_PARA_ROTURA) return { ...e, errosSeguidos: erros };
    return { ...e, fase: "descer", rotura: e.indice, indice: Math.max(0, e.indice - 1), errosSeguidos: 0, acertosSeguidos: 0 };
  }
  if (acertou) {
    const acertos = e.acertosSeguidos + 1;
    if (acertos < ACERTOS_PARA_RECUPERACAO) return { ...e, acertosSeguidos: acertos };
    return { ...e, acertosSeguidos: acertos, recuperacao: e.indice, terminado: true };
  }
  if (e.indice === 0) return { ...e, acertosSeguidos: 0, terminado: true };
  return { ...e, indice: e.indice - 1, acertosSeguidos: 0 };
}

/** O resultado de uma rampa, em Δ. */
export interface RampaEmDelta {
  rotura: number | null;
  recuperacao: number | null;
  /** A fusão aguentou até ao maior degrau do ecrã: a rotura é "acima de" `maximo`. */
  limiteEcra: boolean;
  maximo: number;
}

export const rampaEmDelta = (e: EstadoRampa, niveis: readonly number[]): RampaEmDelta => ({
  rotura: e.rotura === null ? null : niveis[e.rotura],
  recuperacao: e.recuperacao === null ? null : niveis[e.recuperacao],
  limiteEcra: e.atingiuLimite,
  maximo: niveis[e.total - 1],
});

const mediana = (xs: readonly number[]): number | null => {
  if (!xs.length) return null;
  const o = [...xs].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
};

export interface ResumoSentido {
  rampas: number;
  /**
   * Rampas que romperam logo a 0 Δ: nessa rampa não houve fusão nenhuma
   * (distracção, ou a fusão perdeu-se). Contam-se à parte, fora das medianas.
   */
  semFusao: number;
  /** Mediana das roturas, em Δ; `null` sem nenhuma rotura medida. */
  rotura: number | null;
  recuperacao: number | null;
  /** Alguma rampa chegou ao limite do ecrã sem perder a fusão. */
  limiteEcra: boolean;
  /** Maior procura que o ecrã mostrou (para "acima de X Δ"); `null` sem rampas. */
  maximo: number | null;
}

/**
 * Resumo de várias rampas no mesmo sentido: medianas, para uma rampa com um
 * palpite feliz ou uma distracção não mexer no resultado. As rampas que
 * rompem a 0 Δ ficam fora das medianas (ver `semFusao`). A recuperação nunca
 * passa a rotura -- por definição, recupera-se abaixo de onde se rompeu; com
 * medianas de rampas diferentes, isso podia deixar de ser verdade.
 */
export function resumirRampas(rampas: readonly RampaEmDelta[]): ResumoSentido {
  const comFusao = rampas.filter((r) => r.rotura !== 0);
  const rotura = mediana(comFusao.flatMap((r) => (r.rotura === null ? [] : [r.rotura])));
  const recuperacao = mediana(comFusao.flatMap((r) => (r.recuperacao === null ? [] : [r.recuperacao])));
  return {
    rampas: rampas.length,
    semFusao: rampas.length - comFusao.length,
    rotura,
    recuperacao: recuperacao !== null && rotura !== null ? Math.min(recuperacao, rotura) : recuperacao,
    limiteEcra: rampas.some((r) => r.limiteEcra),
    maximo: rampas.length ? Math.max(...rampas.map((r) => r.maximo)) : null,
  };
}

/**
 * Sentidos a treinar, escolhidos pela pessoa conforme o que o oftalmologista
 * indicou (na esotropia não se treina a convergência). Guardado por aparelho.
 */
export type EscolhaSentidos = "ambos" | Sentido;
const CHAVE_SENTIDOS = "jpa.visao.pontes.sentidos";

export const sentidosDaEscolha = (e: EscolhaSentidos): readonly Sentido[] => (e === "ambos" ? SENTIDOS : [e]);

export function lerEscolhaSentidos(): EscolhaSentidos {
  try {
    const v = window.localStorage.getItem(CHAVE_SENTIDOS);
    return v === "convergencia" || v === "divergencia" || v === "ambos" ? v : "ambos";
  } catch {
    return "ambos";
  }
}

export function guardarEscolhaSentidos(e: EscolhaSentidos): void {
  try {
    window.localStorage.setItem(CHAVE_SENTIDOS, e);
  } catch {
    // armazenamento bloqueado: pergunta-se outra vez da próxima
  }
}

/** Passou na verificação a 0 Δ (vê a forma escondida com os anéis sobrepostos)? */
export const passouVerificacao = (certas: number): boolean => certas >= VERIFICACAO_CERTAS;

// --- Desenho -----------------------------------------------------------------

export interface OpcoesPonte {
  /** Palco, em píxeis de dispositivo. */
  largura: number;
  altura: number;
  /** Lado de cada imagem (o anel), em píxeis de dispositivo. */
  lado: number;
  /** Espessura do anel, em píxeis de dispositivo. */
  espessuraAnel: number;
  /** Separação entre as duas imagens (procura de vergência), em píxeis de dispositivo. */
  separacao: number;
  sentido: Sentido;
  /** Disparidade da forma escondida, em píxeis de dispositivo. */
  disparidadeForma: number;
  forma: Forma;
  tamanhoPonto: number;
  rng?: Rng;
}

/**
 * Os dois canais (1 = claro), já no palco inteiro: cada olho vê o seu anel
 * com o estereograma dentro, deslocado metade da separação para o seu lado.
 * Na convergência, a imagem do olho esquerdo vai para a direita.
 */
export function gerarPonteBits(o: OpcoesPonte): { esquerda: Uint8Array; direita: Uint8Array } {
  const { largura: w, altura: h, lado, espessuraAnel } = o;
  const pares = gerarPares({
    largura: lado,
    altura: lado,
    disparidade: o.disparidadeForma,
    forma: o.forma,
    tamanhoPonto: o.tamanhoPonto,
    rng: o.rng,
  });
  const raioFora = lado / 2;
  const raioDentro = raioFora - espessuraAnel;
  /** O que um olho vê no ponto (x, y) da sua imagem. */
  const naImagem = (bits: Uint8Array, x: number, y: number): number => {
    const dx = x + 0.5 - lado / 2;
    const dy = y + 0.5 - lado / 2;
    const r = Math.hypot(dx, dy);
    if (r > raioFora) return 1;
    if (r > raioDentro) return 0; // o anel
    return bits[y * lado + x];
  };

  const meio = o.separacao / 2;
  const sinal = o.sentido === "convergencia" ? 1 : -1;
  const x0Esq = Math.round(w / 2 - lado / 2 + sinal * meio);
  const x0Dir = Math.round(w / 2 - lado / 2 - sinal * meio);
  const y0 = Math.round(h / 2 - lado / 2);

  const esquerda = new Uint8Array(w * h).fill(1);
  const direita = new Uint8Array(w * h).fill(1);
  for (let y = 0; y < lado; y++) {
    const py = y0 + y;
    if (py < 0 || py >= h) continue;
    for (let x = 0; x < lado; x++) {
      const pe = x0Esq + x;
      if (pe >= 0 && pe < w) esquerda[py * w + pe] = naImagem(pares.esquerda, x, y);
      const pd = x0Dir + x;
      if (pd >= 0 && pd < w) direita[py * w + pd] = naImagem(pares.direita, x, y);
    }
  }
  return { esquerda, direita };
}

/** RGBA da ponte, com as cores dos óculos (afinados ou não). */
export function gerarPonte(o: OpcoesPonte & { cores?: readonly Rgb[] }): Uint8ClampedArray {
  const { esquerda, direita } = gerarPonteBits(o);
  const cores = o.cores ?? coresEstereograma(null);
  const px = new Uint8ClampedArray(o.largura * o.altura * 4);
  for (let i = 0; i < esquerda.length; i++) {
    const [r, g, b] = cores[(esquerda[i] << 1) | direita[i]];
    px[i * 4] = r;
    px[i * 4 + 1] = g;
    px[i * 4 + 2] = b;
    px[i * 4 + 3] = 255;
  }
  return px;
}
