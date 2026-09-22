import { describe, it, expect, vi, afterEach } from "vitest";
import {
  PERGUNTAS_OFFLINE_POR_PATAMAR,
  obterPerguntaOfflineNaoVista,
  obterPerguntaOfflinePorId,
  obterPerguntasDoPatamar,
} from "./perguntasOffline";

const TOTAL_PATAMARES = 15;
const MINIMO_POR_PATAMAR = 15;

describe("perguntasOffline", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("tem pelo menos 15 perguntas distintas para cada um dos 15 patamares", () => {
    for (let patamar = 1; patamar <= TOTAL_PATAMARES; patamar++) {
      const perguntas = obterPerguntasDoPatamar(patamar);
      expect(perguntas.length).toBeGreaterThanOrEqual(MINIMO_POR_PATAMAR);
      expect(new Set(perguntas.map((p) => p.id)).size).toBe(perguntas.length);
    }
  });

  it("nunca repete um id entre patamares diferentes", () => {
    const todosOsIds = Object.values(PERGUNTAS_OFFLINE_POR_PATAMAR).flatMap((perguntas) =>
      perguntas.map((p) => p.id)
    );
    expect(new Set(todosOsIds).size).toBe(todosOsIds.length);
  });

  it("distribui as respostas certas por A/B/C/D sem viés (nenhuma letra domina)", () => {
    const contagem = { A: 0, B: 0, C: 0, D: 0 };
    Object.values(PERGUNTAS_OFFLINE_POR_PATAMAR).forEach((perguntas) => {
      perguntas.forEach((p) => {
        contagem[p.resposta_correta] += 1;
      });
    });
    const total = Object.values(contagem).reduce((a, b) => a + b, 0);
    // Nenhuma letra deve responder por muito mais de 1/4 do total -- aqui
    // toleramos alguma folga, mas rejeitamos qualquer viés óbvio (ex.: "a
    // certa é sempre a B").
    Object.values(contagem).forEach((n) => {
      expect(n / total).toBeLessThan(0.35);
      expect(n).toBeGreaterThan(0);
    });
  });

  it("obterPerguntaOfflinePorId encontra uma pergunta em qualquer patamar", () => {
    const doPatamar7 = obterPerguntasDoPatamar(7)[2];
    expect(obterPerguntaOfflinePorId(doPatamar7.id)).toEqual(doPatamar7);
    expect(obterPerguntaOfflinePorId("id-que-nao-existe")).toBeUndefined();
  });

  it("obterPerguntaOfflineNaoVista nunca escolhe uma pergunta já vista, enquanto houver por ver", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const idsDoPatamar1 = obterPerguntasDoPatamar(1).map((p) => p.id);

    const vistos: string[] = [];
    for (let i = 0; i < idsDoPatamar1.length; i++) {
      const escolhida = obterPerguntaOfflineNaoVista(1, vistos);
      expect(vistos).not.toContain(escolhida.id);
      vistos.push(escolhida.id);
    }

    // as 5 escolhas, em conjunto, esgotaram exatamente a reserva do patamar.
    expect(new Set(vistos)).toEqual(new Set(idsDoPatamar1));
  });

  it("quando a reserva do patamar está esgotada, continua a devolver uma pergunta válida em vez de rebentar", () => {
    const idsDoPatamar1 = obterPerguntasDoPatamar(1).map((p) => p.id);

    const escolhida = obterPerguntaOfflineNaoVista(1, idsDoPatamar1);

    expect(idsDoPatamar1).toContain(escolhida.id);
  });

  it("lança um erro claro para um patamar sem reserva de contingência", () => {
    expect(() => obterPerguntaOfflineNaoVista(999, [])).toThrow(/patamar 999/);
  });
});
