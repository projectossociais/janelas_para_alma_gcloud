/**
 * Regras do Multijogador Local do "Inclusivamente" -- 2 pessoas à vez no
 * mesmo aparelho (só 2, decisão do dono do projecto em 2026-11-10: com mais,
 * o ecrã de um telemóvel ficava comprido demais). Lógica pura (sem React nem rede), para ser testada à parte.
 *
 * Formato: `RONDAS` rondas; em cada uma, os dois respondem a uma pergunta
 * (ninguém é eliminado), cada vez mais difícil. Uma
 * resposta certa dá `PONTOS_POR_ACERTO` mais um bónus pela rapidez. Quem
 * começa roda de ronda para ronda.
 *
 * Empate: rondas de desempate, até
 * `MAXIMO_DESEMPATES`; se continuarem empatados, a vitória é partilhada.
 *
 * `RONDAS` e `MAXIMO_DESEMPATES` espelham `api/app/services/jogo_local_service.py`
 * (o servidor só paga o prémio a uma partida com todas as rondas jogadas e
 * limita o número de perguntas). Os pontos são só do aparelho: não decidem
 * o prémio em moedas, que conta os acertos validados pelo servidor.
 */

export const MINIMO_JOGADORES = 2;
export const MAXIMO_JOGADORES = 2;
export const RONDAS = 5;
export const MAXIMO_DESEMPATES = 3;
export const TEMPO_POR_PERGUNTA_LOCAL = 30;
export const TAMANHO_MAXIMO_NOME = 16;

export const PONTOS_POR_ACERTO = 100;
export const BONUS_MAXIMO_RAPIDEZ = 50;

// Patamar (1 a 15, o mesmo do modo de um jogador) de cada ronda: a
// dificuldade sobe ao longo da partida. Os desempates jogam-se no mais difícil.
export const PATAMARES_DAS_RONDAS = [2, 5, 8, 11, 14] as const;
export const PATAMAR_DO_DESEMPATE = 15;

export interface JogadorLocal {
  nome: string;
  pontos: number;
  acertos: number;
}

export interface EstadoPartidaLocal {
  jogadores: JogadorLocal[];
  /** 1 a `RONDAS`; fica em `RONDAS` durante os desempates. */
  ronda: number;
  /** 0 nas rondas normais; 1, 2... no desempate correspondente. */
  desempate: number;
  /** Índices (em `jogadores`) de quem responde nesta ronda, pela ordem. */
  emJogo: number[];
  /** Posição em `emJogo` de quem responde agora. */
  vez: number;
  terminada: boolean;
  /** Índices dos vencedores; mais de um = vitória partilhada. */
  vencedores: number[];
}

/** Limpa os nomes escritos: sem espaços a mais, com tamanho máximo, e com
 *  `nomePorOmissao(n)` ("Jogador 2") para quem deixou em branco. */
export const normalizarNomes = (nomes: readonly string[], nomePorOmissao: (numero: number) => string): string[] =>
  nomes.map((nome, i) => {
    const limpo = nome.replace(/\s+/g, " ").trim().slice(0, TAMANHO_MAXIMO_NOME).trim();
    return limpo || nomePorOmissao(i + 1);
  });

const ordemDaRonda = (numeroJogadores: number, ronda: number): number[] =>
  Array.from({ length: numeroJogadores }, (_, i) => (i + ronda - 1) % numeroJogadores);

export const criarPartidaLocal = (nomes: readonly string[]): EstadoPartidaLocal => {
  if (nomes.length < MINIMO_JOGADORES || nomes.length > MAXIMO_JOGADORES) {
    throw new Error(`Modo local: ${MAXIMO_JOGADORES} jogadores.`);
  }
  return {
    jogadores: nomes.map((nome) => ({ nome, pontos: 0, acertos: 0 })),
    ronda: 1,
    desempate: 0,
    emJogo: ordemDaRonda(nomes.length, 1),
    vez: 0,
    terminada: false,
    vencedores: [],
  };
};

/** Índice (em `jogadores`) de quem responde agora. */
export const indiceDaVez = (estado: EstadoPartidaLocal): number => estado.emJogo[estado.vez];

export const patamarActual = (estado: EstadoPartidaLocal): number =>
  estado.desempate > 0 ? PATAMAR_DO_DESEMPATE : PATAMARES_DAS_RONDAS[estado.ronda - 1];

export const pontosDaResposta = (correta: boolean, tempoRestante: number): number => {
  if (!correta) return 0;
  const fracao = Math.max(0, Math.min(1, tempoRestante / TEMPO_POR_PERGUNTA_LOCAL));
  return PONTOS_POR_ACERTO + Math.round(BONUS_MAXIMO_RAPIDEZ * fracao);
};

const lideres = (jogadores: readonly JogadorLocal[], candidatos: readonly number[]): number[] => {
  const maximo = Math.max(...candidatos.map((i) => jogadores[i].pontos));
  return candidatos.filter((i) => jogadores[i].pontos === maximo);
};

/** Regista a resposta de quem tem a vez e avança: próximo jogador, próxima
 *  ronda, desempate ou fim. Nunca altera o `estado` recebido. */
export const registarResposta = (
  estado: EstadoPartidaLocal,
  correta: boolean,
  tempoRestante: number
): EstadoPartidaLocal => {
  if (estado.terminada) return estado;
  const quem = indiceDaVez(estado);
  const jogadores = estado.jogadores.map((jogador, i) =>
    i === quem
      ? {
          ...jogador,
          pontos: jogador.pontos + pontosDaResposta(correta, tempoRestante),
          acertos: jogador.acertos + (correta ? 1 : 0),
        }
      : jogador
  );

  if (estado.vez + 1 < estado.emJogo.length) return { ...estado, jogadores, vez: estado.vez + 1 };

  if (estado.desempate === 0 && estado.ronda < RONDAS) {
    const ronda = estado.ronda + 1;
    return { ...estado, jogadores, ronda, emJogo: ordemDaRonda(jogadores.length, ronda), vez: 0 };
  }

  // Fim das rondas normais ou de um desempate: quem vai à frente?
  const naFrente = lideres(jogadores, estado.desempate === 0 ? jogadores.map((_, i) => i) : estado.emJogo);
  if (naFrente.length === 1 || estado.desempate >= MAXIMO_DESEMPATES) {
    return { ...estado, jogadores, terminada: true, vencedores: naFrente };
  }
  return { ...estado, jogadores, desempate: estado.desempate + 1, emJogo: naFrente, vez: 0 };
};

/** Jogadores por ordem de pontos (empates pela ordem de entrada), cada um
 *  com o seu índice original. */
export const classificacao = (estado: EstadoPartidaLocal): { indice: number; jogador: JogadorLocal }[] =>
  estado.jogadores
    .map((jogador, indice) => ({ indice, jogador }))
    .sort((a, b) => b.jogador.pontos - a.jogador.pontos || a.indice - b.indice);

/** Total de acertos de todos os jogadores -- o que o prémio em moedas conta. */
export const acertosDeTodos = (estado: EstadoPartidaLocal): number =>
  estado.jogadores.reduce((soma, jogador) => soma + jogador.acertos, 0);
