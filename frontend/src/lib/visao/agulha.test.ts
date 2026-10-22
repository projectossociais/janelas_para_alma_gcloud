import { describe, expect, it } from "vitest";
import { RONDAS_POR_CONDICAO, TEMPO_MAX_S, planoDeRondas, pontosDaRonda, resumirJogador, type ResultadoRonda } from "./agulha";

describe("plano de rondas", () => {
  it("dois jogadores: 3 rondas cada com os dois olhos, depois 3 cada com um, a alternar", () => {
    const p = planoDeRondas(2);
    expect(p).toHaveLength(RONDAS_POR_CONDICAO * 2 * 2);
    expect(p.slice(0, 6).every((r) => r.condicao === "dois")).toBe(true);
    expect(p.slice(6).every((r) => r.condicao === "um")).toBe(true);
    expect(p.slice(0, 4).map((r) => r.jogador)).toEqual([0, 1, 0, 1]);
    // O olho tapado alterna de ronda para ronda.
    expect(p.filter((r) => r.condicao === "um" && r.jogador === 0).map((r) => r.olhoTapado)).toEqual(["esquerdo", "direito", "esquerdo"]);
  });

  it("um jogador sozinho: 6 rondas", () => {
    expect(planoDeRondas(1)).toHaveLength(6);
  });
});

describe("pontos", () => {
  it("acerto rápido vale mais; falhar vale 0", () => {
    expect(pontosDaRonda(true, 1)).toBe(20);
    expect(pontosDaRonda(true, TEMPO_MAX_S)).toBe(10);
    expect(pontosDaRonda(false, 1)).toBe(0);
  });
});

describe("vantagem dos dois olhos", () => {
  const r = (condicao: "dois" | "um", acertou: boolean, segundos = 1, jogador: 0 | 1 = 0): ResultadoRonda => ({ jogador, condicao, acertou, segundos });

  it("acerta tudo com os dois olhos e quase nada com um: grande", () => {
    const s = resumirJogador([r("dois", true), r("dois", true), r("dois", true), r("um", false), r("um", true, 3), r("um", false)], 0);
    expect(s).toMatchObject({ acertosDois: 3, acertosUm: 1, tempoDois: 1, tempoUm: 3, vantagem: "grande" });
  });

  it("igual com um olho: nenhuma (para mostrar ao médico)", () => {
    const s = resumirJogador([r("dois", true), r("dois", true), r("um", true), r("um", true)], 0);
    expect(s.vantagem).toBe("nenhuma");
  });

  it("mesmos acertos mas bem mais lento com um olho: grande", () => {
    const s = resumirJogador([r("dois", true, 1), r("um", true, 2)], 0);
    expect(s.vantagem).toBe("grande");
  });

  it("só conta o jogador pedido", () => {
    const s = resumirJogador([r("dois", true, 1, 1), r("dois", false, 1, 0)], 0);
    expect(s.acertosDois).toBe(0);
  });
});
