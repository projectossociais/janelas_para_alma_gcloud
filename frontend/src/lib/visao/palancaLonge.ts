/**
 * Olhos de Palanca ao longe: acuidade de cada olho a 3 metros, como no
 * consultório, sem óculos nem câmara (desde 2026-10-21).
 *
 * A criança fica a 3 m (ou 2 m numa sala pequena) e responde com a mão:
 * aponta para onde apontam os "dedos" da mãozinha (o E de Snellen a rodar,
 * usado nas consultas de todo o mundo com quem ainda não lê). Um adulto
 * segura o telemóvel virado para ela e desliza o dedo no ecrã nesse sentido
 * -- não precisa de ver o ecrã: o lado para onde a criança aponta é o mesmo
 * lado do ecrã, visto por ela. Pode também responder em voz alta, se o
 * aparelho reconhecer a fala.
 *
 * Desde 2026-11-12 (pesquisa de 2026-11-12, pedido do dono do projecto):
 * - a mãozinha tem quatro barras à volta (aglomeração), porque na ambliopia
 *   por estrabismo um símbolo isolado lê-se muito melhor do que um rodeado;
 *   nos tamanhos em que as barras não cabem no ecrã, a mãozinha fica isolada;
 * - a medição tem duas fases, como no protocolo ATS/e-ETDRS: uma descida
 *   rápida (uma mãozinha por tamanho, até ao primeiro erro) e depois o limiar,
 *   dois tamanhos acima, com 4 por tamanho e 3 para passar (a adivinhar entre
 *   4 lados, passa-se um tamanho em 5% das vezes; com 2 em 3 eram 16%);
 * - antes do primeiro olho há um treino com os dois olhos abertos;
 * - com 2 linhas ou mais de diferença, o olho pior repete-se e fica o melhor
 *   dos dois resultados.
 *
 * Funções puras -- o ecrã vive em `pages/exercises/TesteAcuidade.tsx`.
 */
import { iniciarEscadaTeste, limiarFinoTeste, responderTeste, type EstadoEscadaTeste, type RegraNivel, type Rng } from "./escada";
import type { Olho } from "./resultados";
import { NIVEIS_TESTE_ACUIDADE, aberturaPx, desenhavel } from "./geometria";

export type DireccaoE = "direita" | "baixo" | "esquerda" | "cima";
/** Pela ordem da rotação: 0°, 90°, 180°, 270° (dedos para a direita a 0°). */
export const DIRECCOES_E: readonly DireccaoE[] = ["direita", "baixo", "esquerda", "cima"];
export type RespostaE = DireccaoE | "naosabe";

export const DISTANCIAS_LONGE_MM = [3000, 2000] as const;
export type DistanciaLonge = (typeof DISTANCIAS_LONGE_MM)[number];
/** O E nunca passa desta fracção do lado mais curto do ecrã. */
export const FRACCAO_MAX_ECRA = 0.85;
/** Deslocamento mínimo do dedo (px CSS) para contar como deslizar. */
export const DESLIZE_MIN_PX = 30;
/** Carregar sem deslizar durante este tempo = "não sabe". */
export const PRESSAO_LONGA_MS = 900;
/** Primeiro nível: 0,7 logMAR (6/30), grande o bastante para quase todos. */
export const LOGMAR_INICIAL_LONGE = 0.7;

/** Lado do E (5 traços) em px CSS, para um logMAR a esta distância. */
export const ladoDoEPx = (logmar: number, distanciaMm: number, pxPorMm: number): number =>
  5 * aberturaPx(logmar, distanciaMm, pxPorMm);

/** Os níveis que este ecrã desenha a esta distância: traço visível e E a caber no ecrã. */
export const niveisPalancaLonge = (distanciaMm: number, pxPorMm: number, dpr: number, ladoMaxPx: number): number[] =>
  NIVEIS_TESTE_ACUIDADE.filter(
    (l) => desenhavel(aberturaPx(l, distanciaMm, pxPorMm), dpr) && ladoDoEPx(l, distanciaMm, pxPorMm) <= ladoMaxPx,
  );

// --- Barras à volta da mãozinha (aglomeração) --------------------------------

/** Folga entre a mãozinha e cada barra, em traços: meia mãozinha, como nas tabelas ATS-HOTV. */
export const FOLGA_BARRAS_TRACOS = 2.5;
/** Lado do conjunto (mãozinha + folga + barra de cada lado), em traços. */
export const LADO_COM_BARRAS_TRACOS = 5 + 2 * (FOLGA_BARRAS_TRACOS + 1);

/**
 * O conjunto com barras pode chegar mais perto das margens do que a mãozinha
 * sozinha: num telemóvel de 60 mm, é o que deixa o 6/30 caber com barras a 3 m.
 */
export const FRACCAO_MAX_ECRA_BARRAS = 0.95;

/** Lado do conjunto com barras em px CSS. */
export const ladoComBarrasPx = (logmar: number, distanciaMm: number, pxPorMm: number): number =>
  LADO_COM_BARRAS_TRACOS * aberturaPx(logmar, distanciaMm, pxPorMm);

/** As barras cabem no ecrã neste tamanho? Se não, a mãozinha mostra-se isolada. */
export const cabeComBarras = (logmar: number, distanciaMm: number, pxPorMm: number, ladoMaxPx: number): boolean =>
  ladoComBarrasPx(logmar, distanciaMm, pxPorMm) <= ladoMaxPx;

// --- Medição em duas fases ---------------------------------------------------

/** No limiar: 4 mãozinhas por tamanho, passa com 3. */
export const REGRA_PALANCA: RegraNivel = { tentativas: 4, acertos: 3 };
/** Ao primeiro erro da descida rápida, o limiar começa este número de tamanhos acima. */
export const RECUO_APOS_ERRO = 2;

export interface EstadoPalanca {
  total: number;
  /** Descida rápida: o tamanho que está no ecrã. */
  indiceRapido: number;
  respostasRapidas: number;
  /** `null` enquanto dura a descida rápida. */
  escada: EstadoEscadaTeste | null;
}

export const iniciarPalanca = (total: number, indiceInicial: number): EstadoPalanca => ({
  total,
  indiceRapido: Math.min(Math.max(indiceInicial, 0), total - 1),
  respostasRapidas: 0,
  escada: null,
});

export function responderPalanca(e: EstadoPalanca, acertou: boolean): EstadoPalanca {
  if (e.escada) return { ...e, escada: responderTeste(e.escada, acertou) };
  const base = { ...e, respostasRapidas: e.respostasRapidas + 1 };
  const limiarEm = (i: number) => ({ ...base, escada: iniciarEscadaTeste(e.total, i, REGRA_PALANCA) });
  if (!acertou) return limiarEm(e.indiceRapido - RECUO_APOS_ERRO);
  // Acertou o mais pequeno que o ecrã mostra: confirma-se esse mesmo tamanho.
  if (e.indiceRapido + 1 >= e.total) return limiarEm(e.indiceRapido);
  return { ...base, indiceRapido: e.indiceRapido + 1 };
}

export const indiceDaPalanca = (e: EstadoPalanca): number => e.escada?.indice ?? e.indiceRapido;
export const palancaTerminou = (e: EstadoPalanca): boolean => e.escada?.terminado ?? false;
export const respostasDaPalanca = (e: EstadoPalanca): number => e.respostasRapidas + (e.escada?.respostas ?? 0);
/** logMAR do limiar, contado mãozinha a mãozinha; `null` = nem a maior (ou ainda a meio). */
export const limiarDaPalanca = (e: EstadoPalanca, niveis: readonly number[]): number | null =>
  e.escada?.terminado ? limiarFinoTeste(e.escada, niveis) : null;

// --- Treino com os dois olhos ------------------------------------------------

/** Mãozinhas grandes do treino, com os dois olhos abertos, e quantas é preciso acertar. */
export const TREINO_TOTAL = 4;
export const TREINO_MINIMO = 3;
/** Sem isto, a criança ainda não percebeu o jogo e o resultado não seria de confiança. */
export const treinoPassou = (acertos: number): boolean => acertos >= TREINO_MINIMO;

// --- Confirmar uma diferença entre os olhos ----------------------------------

/** Diferença (logMAR) a partir da qual o olho pior se repete: 2 linhas. */
export const DIFERENCA_A_CONFIRMAR = 0.2;

/**
 * O olho a repetir antes de mostrar o resultado: o pior, quando a diferença
 * é de 2 linhas ou mais (ou quando só um não leu a maior). Uma medição feita
 * em casa varia quase isso de uma vez para a outra; sem repetir, uma
 * distracção num olho virava "sinal a investigar".
 */
export function olhoAConfirmar(direito: number | null, esquerdo: number | null): Olho | null {
  if (direito === null && esquerdo === null) return null;
  if (direito === null) return "direito";
  if (esquerdo === null) return "esquerdo";
  if (Math.abs(direito - esquerdo) < DIFERENCA_A_CONFIRMAR - 1e-9) return null;
  return direito > esquerdo ? "direito" : "esquerdo";
}

/** O melhor de dois limiares (logMAR mais baixo); `null` = não leu a maior. */
export const melhorLimiar = (a: number | null, b: number | null): number | null =>
  a === null ? b : b === null ? a : Math.min(a, b);

/** Direcção de um deslize; `null` se o dedo quase não andou. */
export function direccaoDoGesto(dx: number, dy: number, minimo = DESLIZE_MIN_PX): DireccaoE | null {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.hypot(dx, dy) < minimo) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "direita" : "esquerda";
  return dy > 0 ? "baixo" : "cima";
}

/** Uma direcção nova, nunca igual à anterior. */
export function direccaoAleatoriaE(anterior: DireccaoE | null, rng: Rng = Math.random): DireccaoE {
  const opcoes = DIRECCOES_E.filter((d) => d !== anterior);
  return opcoes[Math.floor(rng() * opcoes.length)];
}

const PALAVRAS: Record<DireccaoE, readonly string[]> = {
  cima: ["cima", "up"],
  baixo: ["baixo", "down"],
  esquerda: ["esquerda", "esquerdo", "left"],
  direita: ["direita", "direito", "right"],
};

/**
 * O que a criança disse, em português ou inglês: "para cima", "esquerda",
 * "não sei"... Duas direcções na mesma frase não contam (a criança hesitou):
 * devolve `null`, e a resposta fica para o deslize do adulto.
 */
export function direccaoDaFala(texto: string): RespostaE | null {
  const limpo = texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  if (/\bnao (sei|vejo)\b|\bdon'?t know\b|\bcan'?t see\b/.test(limpo)) return "naosabe";
  const palavras = new Set(limpo.split(/[^a-z']+/).filter(Boolean));
  const ditas = DIRECCOES_E.filter((d) => PALAVRAS[d].some((p) => palavras.has(p)));
  return ditas.length === 1 ? ditas[0] : null;
}

const CHAVE_DISTANCIA = "jpa.visao.palanca.distancia";

export function lerDistanciaLonge(): DistanciaLonge {
  try {
    return Number(window.localStorage.getItem(CHAVE_DISTANCIA)) === 2000 ? 2000 : 3000;
  } catch {
    return 3000;
  }
}

export function guardarDistanciaLonge(mm: DistanciaLonge): void {
  try {
    window.localStorage.setItem(CHAVE_DISTANCIA, String(mm));
  } catch {
    // armazenamento bloqueado: fica a de omissão
  }
}
