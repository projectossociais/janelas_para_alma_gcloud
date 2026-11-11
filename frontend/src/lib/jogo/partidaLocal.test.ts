import { describe, expect, it } from "vitest";
import {
  BONUS_MAXIMO_RAPIDEZ,
  MAXIMO_DESEMPATES,
  PATAMAR_DO_DESEMPATE,
  PATAMARES_DAS_RONDAS,
  PONTOS_POR_ACERTO,
  RONDAS,
  TEMPO_POR_PERGUNTA_LOCAL,
  acertosDeTodos,
  classificacao,
  criarPartidaLocal,
  indiceDaVez,
  normalizarNomes,
  patamarActual,
  pontosDaResposta,
  registarResposta,
  type EstadoPartidaLocal,
} from "./partidaLocal";

/** Joga respostas em sequência: `true`/`false` (sem bónus de rapidez) ou
 *  `[correta, tempoRestante]`. */
const jogar = (estado: EstadoPartidaLocal, respostas: (boolean | [boolean, number])[]): EstadoPartidaLocal =>
  respostas.reduce<EstadoPartidaLocal>((actual, resposta) => {
    const [correta, tempo] = Array.isArray(resposta) ? resposta : [resposta, 0];
    return registarResposta(actual, correta, tempo);
  }, estado);

describe("normalizarNomes", () => {
  it("apara, limita o tamanho e dá um nome a quem deixou em branco", () => {
    const nomes = normalizarNomes(["  Ana   Maria ", "", "   ", "Um nome muito mais comprido do que cabe"], (n) => `Jogador ${n}`);

    expect(nomes).toEqual(["Ana Maria", "Jogador 2", "Jogador 3", "Um nome muito ma"]);
  });
});

describe("criarPartidaLocal", () => {
  it("só aceita 2 jogadores", () => {
    expect(() => criarPartidaLocal(["Só eu"])).toThrow();
    expect(() => criarPartidaLocal(["a", "b", "c"])).toThrow();
    expect(criarPartidaLocal(["a", "b"]).jogadores).toHaveLength(2);
  });

  it("começa na ronda 1, com o primeiro jogador e todos a zero", () => {
    const estado = criarPartidaLocal(["Ana", "Rui"]);

    expect(estado.ronda).toBe(1);
    expect(indiceDaVez(estado)).toBe(0);
    expect(estado.terminada).toBe(false);
    expect(estado.jogadores.every((j) => j.pontos === 0 && j.acertos === 0)).toBe(true);
  });
});

describe("pontosDaResposta", () => {
  it("uma resposta errada (ou tempo esgotado) não dá pontos", () => {
    expect(pontosDaResposta(false, TEMPO_POR_PERGUNTA_LOCAL)).toBe(0);
  });

  it("uma resposta certa dá os pontos base mais o bónus pela rapidez", () => {
    expect(pontosDaResposta(true, 0)).toBe(PONTOS_POR_ACERTO);
    expect(pontosDaResposta(true, TEMPO_POR_PERGUNTA_LOCAL)).toBe(PONTOS_POR_ACERTO + BONUS_MAXIMO_RAPIDEZ);
    expect(pontosDaResposta(true, TEMPO_POR_PERGUNTA_LOCAL / 2)).toBe(PONTOS_POR_ACERTO + BONUS_MAXIMO_RAPIDEZ / 2);
  });

  it("um tempo fora do intervalo nunca dá mais do que o bónus máximo nem menos do que a base", () => {
    expect(pontosDaResposta(true, 9999)).toBe(PONTOS_POR_ACERTO + BONUS_MAXIMO_RAPIDEZ);
    expect(pontosDaResposta(true, -5)).toBe(PONTOS_POR_ACERTO);
  });
});

describe("registarResposta", () => {
  it("passa a vez ao jogador seguinte e não altera o estado recebido", () => {
    const inicio = criarPartidaLocal(["Ana", "Rui"]);

    const depois = registarResposta(inicio, true, 10);

    expect(indiceDaVez(depois)).toBe(1);
    expect(depois.jogadores[0].acertos).toBe(1);
    expect(inicio.jogadores[0].acertos).toBe(0);
    expect(inicio.vez).toBe(0);
  });

  it("os dois respondem em todas as rondas, e quem começa vai alternando", () => {
    let estado = criarPartidaLocal(["Ana", "Rui"]);
    const ordem: number[][] = [];
    for (let ronda = 1; ronda <= RONDAS; ronda++) {
      expect(estado.ronda).toBe(ronda);
      const destaRonda: number[] = [];
      for (let i = 0; i < 2; i++) {
        destaRonda.push(indiceDaVez(estado));
        // Só a Ana acerta, para a partida não acabar empatada.
        estado = registarResposta(estado, indiceDaVez(estado) === 0, 0);
      }
      ordem.push(destaRonda);
    }

    expect(ordem).toEqual([
      [0, 1],
      [1, 0],
      [0, 1],
      [1, 0],
      [0, 1],
    ]);
    expect(estado.terminada).toBe(true);
  });

  it("a dificuldade sobe de ronda para ronda", () => {
    let estado = criarPartidaLocal(["Ana", "Rui"]);
    const patamares: number[] = [];
    for (let ronda = 1; ronda <= RONDAS; ronda++) {
      patamares.push(patamarActual(estado));
      estado = jogar(estado, [true, false]);
    }

    expect(patamares).toEqual([...PATAMARES_DAS_RONDAS]);
    expect(PATAMARES_DAS_RONDAS).toHaveLength(RONDAS);
  });

  it("ganha quem tem mais pontos no fim das rondas", () => {
    // A ordem roda: ronda 1 = Ana, Rui; ronda 2 = Rui, Ana; ...
    const fim = jogar(criarPartidaLocal(["Ana", "Rui"]), [
      true, false, // r1: Ana certa
      true, true, // r2: Rui, Ana
      false, true, // r3: Ana errada, Rui certo
      false, true, // r4: Rui errado, Ana certa
      false, false, // r5
    ]);

    expect(fim.terminada).toBe(true);
    expect(fim.vencedores).toEqual([0]);
    expect(fim.jogadores.map((j) => j.acertos)).toEqual([3, 2]);
    expect(acertosDeTodos(fim)).toBe(5);
    expect(classificacao(fim).map((c) => c.jogador.nome)).toEqual(["Ana", "Rui"]);
  });

  it("com os mesmos acertos, ganha quem respondeu mais depressa", () => {
    const fim = jogar(
      criarPartidaLocal(["Ana", "Rui"]),
      Array.from({ length: RONDAS * 2 }, (_, i): [boolean, number] => {
        // Rondas ímpares começam na Ana, pares no Rui (ver o teste da ordem).
        const ronda = Math.floor(i / 2) + 1;
        const eARui = (i % 2 === 0) === (ronda % 2 === 0);
        return [true, eARui ? 25 : 5];
      })
    );

    expect(fim.terminada).toBe(true);
    expect(fim.vencedores).toEqual([1]);
  });

  it("depois de terminada, mais respostas não mudam nada", () => {
    const fim = jogar(criarPartidaLocal(["Ana", "Rui"]), [true, ...Array(RONDAS * 2 - 1).fill(false)]);

    expect(registarResposta(fim, true, 30)).toBe(fim);
  });
});

describe("empates", () => {
  const empatados = (nomes: string[]) =>
    jogar(criarPartidaLocal(nomes), Array(RONDAS * nomes.length).fill(false));

  it("empate no fim das rondas abre um desempate, na pergunta mais difícil", () => {
    const estado = empatados(["Ana", "Rui"]);

    expect(estado.terminada).toBe(false);
    expect(estado.desempate).toBe(1);
    expect(estado.emJogo).toEqual([0, 1]);
    expect(patamarActual(estado)).toBe(PATAMAR_DO_DESEMPATE);
  });

  it("o desempate acaba assim que um dos empatados passa à frente", () => {
    const fim = jogar(empatados(["Ana", "Rui"]), [false, true]);

    expect(fim.terminada).toBe(true);
    expect(fim.vencedores).toEqual([1]);
  });

  it("um desempate em que os dois acertam com a mesma rapidez continua empatado", () => {
    const depois = jogar(empatados(["Ana", "Rui"]), [[true, 10], [true, 10]]);

    expect(depois.terminada).toBe(false);
    expect(depois.desempate).toBe(2);
  });

  it(`ao fim de ${MAXIMO_DESEMPATES} desempates sem decisão, a vitória é partilhada`, () => {
    const fim = jogar(empatados(["Ana", "Rui"]), Array(MAXIMO_DESEMPATES * 2).fill(false));

    expect(fim.terminada).toBe(true);
    expect(fim.desempate).toBe(MAXIMO_DESEMPATES);
    expect(fim.vencedores).toEqual([0, 1]);
  });

  it("nunca pede mais perguntas do que o servidor aceita por partida", () => {
    // O servidor limita a jogadores x (RONDAS + MAXIMO_DESEMPATES).
    let estado = criarPartidaLocal(["Ana", "Rui"]);
    let perguntas = 0;
    while (!estado.terminada) {
      estado = registarResposta(estado, false, 0);
      perguntas++;
    }
    expect(perguntas).toBe(2 * (RONDAS + MAXIMO_DESEMPATES));
  });
});
