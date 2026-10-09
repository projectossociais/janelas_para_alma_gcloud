/**
 * Motores de escada (staircase), independentes do estímulo: trabalham com
 * índices numa lista de níveis ordenada do **mais fácil (0) para o mais
 * difícil**. Quem chama converte o índice em logMAR, contraste, disparidade...
 *
 * Funções puras sobre estado imutável -- testáveis sem React.
 */

export type Rng = () => number;

/** Direcção da abertura do anel: 0..7, em múltiplos de 45 graus. */
export type Direccao = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Direcção aleatória, nunca igual à anterior. */
export function direccaoAleatoria(anterior: Direccao | null, rng: Rng = Math.random): Direccao {
  if (anterior === null) return Math.floor(rng() * 8) as Direccao;
  const salto = 1 + Math.floor(rng() * 7); // 1..7: nunca 0
  return ((anterior + salto) % 8) as Direccao;
}

/** Escolha aleatória entre `n` opções, nunca igual à anterior (n >= 2). */
export function escolhaAleatoria(n: number, anterior: number | null, rng: Rng = Math.random): number {
  if (anterior === null || n < 2) return Math.floor(rng() * n);
  return (anterior + 1 + Math.floor(rng() * (n - 1))) % n;
}

// --- Teste ------------------------------------------------------------------

/** Apresentações por nível e acertos para passar. */
export const TENTATIVAS_POR_NIVEL = 3;
export const ACERTOS_PARA_PASSAR = 2;

export interface EstadoEscadaTeste {
  total: number;
  indice: number;
  acertosNoNivel: number;
  errosNoNivel: number;
  /** Índices já passados / falhados (para decidir quando parar). */
  passados: readonly number[];
  falhados: readonly number[];
  terminado: boolean;
  /** Índice do nível mais difícil passado; `null` = nenhum (nem o mais fácil). */
  limiar: number | null;
  /** Passou o nível mais difícil que o ecrã consegue mostrar. */
  atingiuLimite: boolean;
  respostas: number;
}

export function iniciarEscadaTeste(total: number, indiceInicial: number): EstadoEscadaTeste {
  if (total < 1) throw new Error("escada sem niveis") // erro interno, nunca chega ao ecrã;
  return {
    total,
    indice: Math.min(Math.max(indiceInicial, 0), total - 1),
    acertosNoNivel: 0,
    errosNoNivel: 0,
    passados: [],
    falhados: [],
    terminado: false,
    limiar: null,
    atingiuLimite: false,
    respostas: 0,
  };
}

/**
 * Regista uma resposta. 3 optótipos por nível, passa com 2 acertos (decide
 * assim que 2 acertos ou 2 erros tornam o resultado certo). A passar sobe a
 * dificuldade; a falhar sem nenhum nível passado ainda, desce para níveis
 * maiores; pára quando um nível passado fica ao lado de um falhado.
 */
export function responderTeste(e: EstadoEscadaTeste, acertou: boolean): EstadoEscadaTeste {
  if (e.terminado) return e;
  const acertos = e.acertosNoNivel + (acertou ? 1 : 0);
  const erros = e.errosNoNivel + (acertou ? 0 : 1);
  const base = { ...e, acertosNoNivel: acertos, errosNoNivel: erros, respostas: e.respostas + 1 };

  const errosPermitidos = TENTATIVAS_POR_NIVEL - ACERTOS_PARA_PASSAR;
  if (acertos >= ACERTOS_PARA_PASSAR) return passarNivel(base);
  if (erros > errosPermitidos) return falharNivel(base);
  return base;
}

function proximoNivel(e: EstadoEscadaTeste, indice: number): EstadoEscadaTeste {
  return { ...e, indice, acertosNoNivel: 0, errosNoNivel: 0 };
}

function passarNivel(e: EstadoEscadaTeste): EstadoEscadaTeste {
  const i = e.indice;
  const passados = [...e.passados, i];
  const seguinte = i + 1;
  if (seguinte >= e.total) {
    return { ...e, passados, terminado: true, limiar: i, atingiuLimite: true };
  }
  if (e.falhados.includes(seguinte)) {
    return { ...e, passados, terminado: true, limiar: i };
  }
  return proximoNivel({ ...e, passados }, seguinte);
}

function falharNivel(e: EstadoEscadaTeste): EstadoEscadaTeste {
  const i = e.indice;
  const falhados = [...e.falhados, i];
  const anterior = i - 1;
  if (e.passados.includes(anterior)) {
    return { ...e, falhados, terminado: true, limiar: anterior };
  }
  if (anterior < 0) {
    return { ...e, falhados, terminado: true, limiar: null };
  }
  return proximoNivel({ ...e, falhados }, anterior);
}

// --- Treino -----------------------------------------------------------------

/** Quantas inversões recentes entram na estimativa do limiar do treino. */
export const INVERSOES_PARA_LIMIAR = 6;

export interface EstadoEscadaTreino {
  total: number;
  indice: number;
  acertosSeguidos: number;
  /** Última direcção de movimento: +1 mais difícil, -1 mais fácil. */
  ultimoSentido: 1 | -1 | 0;
  inversoes: readonly number[];
  respostas: number;
  acertos: number;
  /** Índice mais difícil alcançado. */
  melhor: number;
}

export function iniciarEscadaTreino(total: number, indiceInicial: number): EstadoEscadaTreino {
  if (total < 1) throw new Error("escada sem niveis") // erro interno, nunca chega ao ecrã;
  const indice = Math.min(Math.max(indiceInicial, 0), total - 1);
  return {
    total,
    indice,
    acertosSeguidos: 0,
    ultimoSentido: 0,
    inversoes: [],
    respostas: 0,
    acertos: 0,
    melhor: indice,
  };
}

/** 2 acertos seguidos -> mais difícil; 1 erro -> mais fácil. */
export function responderTreino(e: EstadoEscadaTreino, acertou: boolean): EstadoEscadaTreino {
  const base = { ...e, respostas: e.respostas + 1, acertos: e.acertos + (acertou ? 1 : 0) };
  if (acertou) {
    const seguidos = e.acertosSeguidos + 1;
    if (seguidos < 2) return { ...base, acertosSeguidos: seguidos };
    return mover({ ...base, acertosSeguidos: 0 }, 1);
  }
  return mover({ ...base, acertosSeguidos: 0 }, -1);
}

function mover(e: EstadoEscadaTreino, sentido: 1 | -1): EstadoEscadaTreino {
  const indice = Math.min(Math.max(e.indice + sentido, 0), e.total - 1);
  const inverteu = e.ultimoSentido !== 0 && e.ultimoSentido !== sentido;
  return {
    ...e,
    indice,
    ultimoSentido: sentido,
    inversoes: inverteu ? [...e.inversoes, e.indice] : e.inversoes,
    melhor: Math.max(e.melhor, indice),
  };
}

/**
 * Estimativa do limiar do treino, em índice (pode ser fraccionária): média
 * das últimas inversões; sem inversões suficientes, o nível actual.
 */
export function limiarTreino(e: EstadoEscadaTreino): number {
  const ultimas = e.inversoes.slice(-INVERSOES_PARA_LIMIAR);
  if (ultimas.length < 2) return e.indice;
  return ultimas.reduce((s, x) => s + x, 0) / ultimas.length;
}

/** Índice do nível mais próximo de `valor` numa lista ordenada. */
export function indiceMaisProximo(niveis: readonly number[], valor: number): number {
  let melhor = 0;
  for (let i = 1; i < niveis.length; i++) {
    if (Math.abs(niveis[i] - valor) < Math.abs(niveis[melhor] - valor)) melhor = i;
  }
  return melhor;
}

/** Interpolação linear de um índice fraccionário numa lista de níveis. */
export function valorNoIndice(niveis: readonly number[], indice: number): number {
  const i0 = Math.floor(indice);
  const i1 = Math.min(i0 + 1, niveis.length - 1);
  const f = indice - i0;
  return niveis[i0] + (niveis[i1] - niveis[i0]) * f;
}
