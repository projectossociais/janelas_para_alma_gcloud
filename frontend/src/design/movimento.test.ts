import { describe, expect, it } from "vitest";
import { DURACAO, MOLA, razaoAmortecimento } from "./movimento";

// PESQUISA_UX §3: ~100 ms para feedback, 200-500 ms para mudanças maiores
// (NN/g); transições de tarefa sem ressalto.
describe("movimento", () => {
  it("durações dentro dos intervalos da pesquisa", () => {
    expect(DURACAO.feedback).toBeLessThanOrEqual(0.12);
    expect(DURACAO.transicao).toBeGreaterThanOrEqual(0.2);
    expect(DURACAO.transicao).toBeLessThanOrEqual(0.3);
    expect(DURACAO.entrada).toBeLessThanOrEqual(0.5);
  });

  it("a mola das tarefas não ressalta (razão de amortecimento ≥ 0,9)", () => {
    expect(razaoAmortecimento(MOLA.tarefa)).toBeGreaterThanOrEqual(0.9);
  });

  it("a mola de celebração ressalta pouco (razão ≥ 0,6)", () => {
    expect(razaoAmortecimento(MOLA.celebracao)).toBeGreaterThanOrEqual(0.6);
  });
});
