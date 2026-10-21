import { describe, expect, it } from "vitest";
import { ORIENTACAO_INICIAL, ORIENTACAO_MAX, ORIENTACAO_MIN } from "./kianda";
import {
  ALVOS_PESCA,
  CERTOS_POR_NIVEL,
  NIVEIS_PESCA,
  iniciarPesca,
  limiarPesca,
  norm180,
  orientacaoDoPeixe,
  outroAlvo,
  precisaoPesca,
  registarPesca,
  type EstadoPesca,
  type EventoPesca,
} from "./pescaKianda";

const fixo = (v: number) => () => v;
const correr = (evs: EventoPesca[], e: EstadoPesca = iniciarPesca(fixo(0))) =>
  evs.reduce((acc, ev) => registarPesca(acc, ev, fixo(0.5)), e);
const vezes = (n: number, ev: EventoPesca): EventoPesca[] => Array.from({ length: n }, () => ev);

describe("escada da inclinação", () => {
  it("começa fácil", () => {
    expect(iniciarPesca().diferenca).toBe(ORIENTACAO_INICIAL);
  });

  it("dois certos seguidos tornam mais difícil; um errado mais fácil", () => {
    expect(correr(vezes(2, "certo")).diferenca).toBeLessThan(ORIENTACAO_INICIAL);
    expect(correr(["certo"]).diferenca).toBe(ORIENTACAO_INICIAL);
    expect(correr(["errado"]).diferenca).toBe(ORIENTACAO_MAX);
  });

  it("nunca sai dos limites", () => {
    expect(correr(vezes(200, "certo")).diferenca).toBe(ORIENTACAO_MIN);
  });

  it("peixes que fogem e alforrecas não mexem na escada", () => {
    const e = correr([...vezes(5, "fugiu"), ...vezes(3, "alforreca")]);
    expect(e.diferenca).toBe(ORIENTACAO_INICIAL);
    expect(e.totais).toMatchObject({ fugidos: 5, alforrecas: 3 });
    expect(limiarPesca(e)).toBeNull();
  });

  it("o limiar é a mediana das diferenças nos últimos peixes apanhados", () => {
    const e = correr(vezes(40, "certo"));
    expect(limiarPesca(e)).toBeLessThan(10);
    expect(limiarPesca(correr(["errado"]))).toBe(ORIENTACAO_INICIAL);
  });
});

describe("níveis", () => {
  it(`sobe a cada ${CERTOS_POR_NIVEL} certos, com um sinal novo`, () => {
    const inicio = iniciarPesca(fixo(0));
    const e = correr(vezes(CERTOS_POR_NIVEL, "certo"), inicio);
    expect(e.nivel).toBe(2);
    expect(e.certosNoNivel).toBe(0);
    expect(e.alvo).not.toBe(inicio.alvo);
  });

  it("não passa do último nível", () => {
    const e = correr(vezes(CERTOS_POR_NIVEL * (NIVEIS_PESCA.length + 3), "certo"));
    expect(e.nivel).toBe(NIVEIS_PESCA.length);
  });

  it("os níveis ficam mais difíceis: peixes mais pequenos, riscas mais finas e mais esbatidas", () => {
    for (let i = 1; i < NIVEIS_PESCA.length; i++) {
      expect(NIVEIS_PESCA[i].peixeMm).toBeLessThan(NIVEIS_PESCA[i - 1].peixeMm);
      expect(NIVEIS_PESCA[i].periodoMm).toBeLessThan(NIVEIS_PESCA[i - 1].periodoMm);
      expect(NIVEIS_PESCA[i].contraste).toBeLessThan(NIVEIS_PESCA[i - 1].contraste);
    }
  });
});

describe("peixes e sinal", () => {
  it("o peixe certo tem a inclinação do sinal; os outros, a diferença actual para um dos lados", () => {
    const e = { ...iniciarPesca(fixo(0)), alvo: 10, diferenca: 25 };
    expect(orientacaoDoPeixe(e, true)).toBe(10);
    expect(orientacaoDoPeixe(e, false, fixo(0.9))).toBe(35);
    expect(orientacaoDoPeixe(e, false, fixo(0.1))).toBe(165); // -15 -> 165
  });

  it("norm180 trata inclinações como linhas (0 = 180)", () => {
    expect(norm180(180)).toBe(0);
    expect(norm180(-30)).toBe(150);
  });

  it("um sinal novo é sempre outro", () => {
    for (const a of ALVOS_PESCA) for (const r of [0, 0.5, 0.99]) expect(outroAlvo(a, fixo(r))).not.toBe(a);
  });

  it("precisão: certos sobre todos os apanhados", () => {
    expect(precisaoPesca(iniciarPesca())).toBeNull();
    expect(precisaoPesca(correr([...vezes(3, "certo"), "errado"]))).toBe(75);
  });
});
