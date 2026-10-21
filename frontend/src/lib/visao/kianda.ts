/**
 * Kianda: treino dicóptico em jogo, com os dois olhos abertos e os óculos
 * vermelho-ciano. Pesca no mar da Ilha de Luanda.
 *
 * - O olho mais fraco vê os peixes, com contraste alto. As escamas são um
 *   padrão de Gabor: só se apanham os peixes com a risca inclinada como o
 *   sinal da Kianda (discriminação de orientação, aprendizagem perceptual).
 * - O olho mais forte vê as rochas, com contraste reduzido. Bater numa rocha
 *   prende a rede.
 * - A rede e o sinal vêem-se com os dois olhos.
 *
 * Só se joga bem com os dois olhos. É o princípio do treino binocular com
 * contraste reequilibrado (Birch, Kelly et al.; Hess et al.): o contraste do
 * olho forte começa baixo, para o cérebro não suprimir o olho fraco, e sobe
 * quando o olho fraco aguenta. Até onde sobe, sessão após sessão, é a métrica
 * do treino (razão de contraste entre os olhos: 1 = equilíbrio).
 *
 * Funções puras -- o desenho e o tempo vivem em `components/visao/JogoKianda.tsx`.
 */

/** Contraste do olho forte com que começa uma pessoa sem histórico. */
export const CONTRASTE_INICIAL = 0.2;
export const CONTRASTE_MIN = 0.1;
export const CONTRASTE_MAX = 1;
export const PASSO_CONTRASTE = 0.1;
/** Uma ronda = este número de peixes certos que passaram (apanhados ou fugidos). */
export const PEIXES_POR_RONDA = 10;
/** Taxa de acerto na ronda para subir / descer o contraste do olho forte. */
export const TAXA_SUBIR = 0.7;
export const TAXA_DESCER = 0.5;

/** Diferença de orientação entre o peixe certo e os outros, em graus. */
export const ORIENTACAO_INICIAL = 40;
export const ORIENTACAO_MIN = 4;
export const ORIENTACAO_MAX = 45;
/** 2 certos seguidos -> mais difícil; 1 errado -> mais fácil (converge para ~71%). */
export const FACTOR_DIFICIL = 0.85;
export const FACTOR_FACIL = 1.25;
/** Quantas diferenças de orientação recentes entram no limiar da sessão. */
export const JANELA_ORIENTACAO = 12;

export type EventoKianda = "apanhou_certo" | "apanhou_errado" | "fugiu_certo" | "colisao";

export interface EstadoKianda {
  contraste: number;
  orientacao: number;
  certosSeguidos: number;
  /** Ronda em curso. */
  ronda: { certos: number; fugidos: number; errados: number };
  /** Maior contraste em que se fechou uma ronda com `TAXA_SUBIR` ou mais. */
  contrasteSustentado: number | null;
  /** Diferenças de orientação nos últimos peixes apanhados. */
  orientacoes: readonly number[];
  totais: { certos: number; errados: number; fugidos: number; colisoes: number; rondas: number };
}

const arred = (x: number, casas = 2) => Math.round(x * 10 ** casas) / 10 ** casas;
const limitar = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));

export function iniciarKianda(contrasteInicial = CONTRASTE_INICIAL): EstadoKianda {
  return {
    contraste: arred(limitar(contrasteInicial, CONTRASTE_MIN, CONTRASTE_MAX)),
    orientacao: ORIENTACAO_INICIAL,
    certosSeguidos: 0,
    ronda: { certos: 0, fugidos: 0, errados: 0 },
    contrasteSustentado: null,
    orientacoes: [],
    totais: { certos: 0, errados: 0, fugidos: 0, colisoes: 0, rondas: 0 },
  };
}

/**
 * Taxa de acerto de uma ronda: peixes certos apanhados sobre os que
 * passaram, descontando os errados apanhados (apanhar tudo à sorte não
 * conta como acertar).
 */
export const taxaDaRonda = (r: EstadoKianda["ronda"]): number => {
  const passaram = r.certos + r.fugidos;
  return passaram ? Math.max(0, r.certos - r.errados) / passaram : 0;
};

/** Fecha a ronda: sobe, mantém ou desce o contraste do olho forte. */
function fecharRonda(e: EstadoKianda): EstadoKianda {
  const taxa = taxaDaRonda(e.ronda);
  let { contraste, contrasteSustentado } = e;
  if (taxa >= TAXA_SUBIR) {
    contrasteSustentado = Math.max(contrasteSustentado ?? 0, contraste);
    contraste = arred(Math.min(CONTRASTE_MAX, contraste + PASSO_CONTRASTE));
  } else if (taxa < TAXA_DESCER) {
    contraste = arred(Math.max(CONTRASTE_MIN, contraste - PASSO_CONTRASTE));
  }
  return {
    ...e,
    contraste,
    contrasteSustentado,
    ronda: { certos: 0, fugidos: 0, errados: 0 },
    totais: { ...e.totais, rondas: e.totais.rondas + 1 },
  };
}

/**
 * Um acontecimento do jogo. Só os peixes do olho fraco mexem no contraste do
 * olho forte; as rochas (olho forte) só custam tempo -- com o contraste baixo
 * elas vêem-se mal, e isso não deve baixá-lo ainda mais.
 */
export function registarEvento(e: EstadoKianda, evento: EventoKianda): EstadoKianda {
  const totais = { ...e.totais };
  let { orientacao, certosSeguidos, orientacoes } = e;
  const ronda = { ...e.ronda };

  switch (evento) {
    case "colisao":
      return { ...e, totais: { ...totais, colisoes: totais.colisoes + 1 } };
    case "apanhou_certo":
      totais.certos += 1;
      ronda.certos += 1;
      orientacoes = [...orientacoes, orientacao].slice(-JANELA_ORIENTACAO);
      certosSeguidos += 1;
      if (certosSeguidos >= 2) {
        orientacao = arred(Math.max(ORIENTACAO_MIN, orientacao * FACTOR_DIFICIL), 1);
        certosSeguidos = 0;
      }
      break;
    case "apanhou_errado":
      totais.errados += 1;
      ronda.errados += 1;
      orientacoes = [...orientacoes, orientacao].slice(-JANELA_ORIENTACAO);
      certosSeguidos = 0;
      orientacao = arred(Math.min(ORIENTACAO_MAX, orientacao * FACTOR_FACIL), 1);
      break;
    case "fugiu_certo":
      totais.fugidos += 1;
      ronda.fugidos += 1;
      break;
  }

  const seguinte: EstadoKianda = { ...e, orientacao, certosSeguidos, orientacoes, ronda, totais };
  return ronda.certos + ronda.fugidos >= PEIXES_POR_RONDA ? fecharRonda(seguinte) : seguinte;
}

const mediana = (xs: readonly number[]): number | null => {
  if (!xs.length) return null;
  const o = [...xs].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
};

/** Diferença de orientação típica no fim da sessão (mediana dos últimos peixes apanhados). */
export const limiarOrientacao = (e: EstadoKianda): number | null => {
  const m = mediana(e.orientacoes);
  return m === null ? null : arred(m, 1);
};

/**
 * Contraste com que começa a sessão seguinte: um passo abaixo do último
 * contraste a que se chegou, para aquecer. Sem histórico, o inicial.
 */
export const contrasteDePartida = (ultimoContraste: number | null | undefined): number =>
  typeof ultimoContraste === "number" && Number.isFinite(ultimoContraste)
    ? arred(limitar(ultimoContraste - PASSO_CONTRASTE, CONTRASTE_MIN, CONTRASTE_MAX))
    : CONTRASTE_INICIAL;

// --- Modo de treino ----------------------------------------------------------

/** Com óculos 3D (dicóptico) ou sem (tapa-olho, Treino de Anéis). Por aparelho. */
export type ModoKianda = "oculos" | "tapaOlho";
const CHAVE_MODO = "jpa.visao.kianda.modo";

export function lerModoKianda(): ModoKianda | null {
  try {
    const v = window.localStorage.getItem(CHAVE_MODO);
    return v === "oculos" || v === "tapaOlho" ? v : null;
  } catch {
    return null;
  }
}

export function guardarModoKianda(m: ModoKianda): void {
  try {
    window.localStorage.setItem(CHAVE_MODO, m);
  } catch {
    // armazenamento bloqueado: pergunta-se outra vez
  }
}
