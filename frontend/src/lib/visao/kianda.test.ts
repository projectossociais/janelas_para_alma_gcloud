import { describe, expect, it } from "vitest";
import {
  CONTRASTE_INICIAL,
  CONTRASTE_MAX,
  CONTRASTE_MIN,
  ORIENTACAO_INICIAL,
  ORIENTACAO_MIN,
  PEIXES_POR_RONDA,
  contrasteDePartida,
  guardarModoKianda,
  iniciarKianda,
  lerModoKianda,
  limiarOrientacao,
  registarEvento,
  taxaDaRonda,
  type EstadoKianda,
  type EventoKianda,
} from "./kianda";

const correr = (eventos: EventoKianda[], inicio: EstadoKianda = iniciarKianda()) => eventos.reduce(registarEvento, inicio);
const vezes = (n: number, e: EventoKianda): EventoKianda[] => Array.from({ length: n }, () => e);

describe("contraste do olho forte (reequilíbrio)", () => {
  it("começa baixo", () => {
    expect(iniciarKianda().contraste).toBe(CONTRASTE_INICIAL);
  });

  it("uma ronda com 70% ou mais sobe um passo e fica como sustentado", () => {
    const e = correr([...vezes(7, "apanhou_certo"), ...vezes(3, "fugiu_certo")]);
    expect(e.contraste).toBe(0.3);
    expect(e.contrasteSustentado).toBe(0.2);
    expect(e.totais.rondas).toBe(1);
  });

  it("uma ronda abaixo de 50% desce um passo", () => {
    const e = correr([...vezes(4, "apanhou_certo"), ...vezes(6, "fugiu_certo")], iniciarKianda(0.5));
    expect(e.contraste).toBe(0.4);
    expect(e.contrasteSustentado).toBeNull();
  });

  it("entre 50% e 70% mantém", () => {
    const e = correr([...vezes(6, "apanhou_certo"), ...vezes(4, "fugiu_certo")], iniciarKianda(0.5));
    expect(e.contraste).toBe(0.5);
  });

  it("apanhar peixes errados desconta na taxa", () => {
    expect(taxaDaRonda({ certos: 8, fugidos: 2, errados: 3 })).toBe(0.5);
  });

  it("as rochas não mexem no contraste nem fecham rondas", () => {
    const e = correr(vezes(30, "colisao"));
    expect(e.contraste).toBe(CONTRASTE_INICIAL);
    expect(e.totais.colisoes).toBe(30);
    expect(e.totais.rondas).toBe(0);
  });

  it("nunca passa dos limites", () => {
    let e = iniciarKianda(0.95);
    for (let i = 0; i < 3; i++) e = correr(vezes(PEIXES_POR_RONDA, "apanhou_certo"), e);
    expect(e.contraste).toBe(CONTRASTE_MAX);
    let f = iniciarKianda(0.15);
    for (let i = 0; i < 3; i++) f = correr(vezes(PEIXES_POR_RONDA, "fugiu_certo"), f);
    expect(f.contraste).toBe(CONTRASTE_MIN);
  });

  it("o sustentado é o maior contraste em que uma ronda correu bem", () => {
    let e = iniciarKianda(0.3);
    e = correr(vezes(PEIXES_POR_RONDA, "apanhou_certo"), e); // 0,3 bem -> 0,4
    e = correr(vezes(PEIXES_POR_RONDA, "apanhou_certo"), e); // 0,4 bem -> 0,5
    e = correr(vezes(PEIXES_POR_RONDA, "fugiu_certo"), e); // 0,5 mal -> 0,4
    expect(e.contrasteSustentado).toBe(0.4);
    expect(e.contraste).toBe(0.4);
  });
});

describe("orientação (aprendizagem perceptual no olho fraco)", () => {
  it("dois certos seguidos tornam mais difícil", () => {
    expect(correr(vezes(2, "apanhou_certo")).orientacao).toBeLessThan(ORIENTACAO_INICIAL);
  });

  it("um errado torna mais fácil", () => {
    expect(correr(["apanhou_errado"]).orientacao).toBeGreaterThan(ORIENTACAO_INICIAL);
  });

  it("nunca desce abaixo do mínimo", () => {
    expect(correr(vezes(200, "apanhou_certo")).orientacao).toBe(ORIENTACAO_MIN);
  });

  it("o limiar é a mediana dos últimos peixes apanhados", () => {
    expect(limiarOrientacao(iniciarKianda())).toBeNull();
    const e = correr(vezes(40, "apanhou_certo"));
    expect(limiarOrientacao(e)).toBeLessThan(10);
  });

  it("peixes que fogem não contam para a orientação", () => {
    expect(correr(vezes(5, "fugiu_certo")).orientacao).toBe(ORIENTACAO_INICIAL);
  });
});

describe("contrasteDePartida", () => {
  it("um passo abaixo do último, para aquecer", () => {
    expect(contrasteDePartida(0.6)).toBe(0.5);
    expect(contrasteDePartida(0.15)).toBe(CONTRASTE_MIN);
  });

  it("sem histórico, o inicial", () => {
    expect(contrasteDePartida(null)).toBe(CONTRASTE_INICIAL);
    expect(contrasteDePartida(undefined)).toBe(CONTRASTE_INICIAL);
  });
});

describe("modo", () => {
  it("guarda e lê por aparelho", () => {
    window.localStorage.clear();
    expect(lerModoKianda()).toBeNull();
    guardarModoKianda("oculos");
    expect(lerModoKianda()).toBe("oculos");
    window.localStorage.setItem("jpa.visao.kianda.modo", "outro");
    expect(lerModoKianda()).toBeNull();
    window.localStorage.clear();
  });
});
