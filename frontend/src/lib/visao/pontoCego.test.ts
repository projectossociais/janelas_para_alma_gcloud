import { describe, expect, it } from "vitest";
import {
  ANGULO_PONTO_CEGO_GRAUS,
  DISTANCIA_MAX_MM,
  DISTANCIA_MIN_MM,
  INICIO_PONTO_MM,
  MEDICOES_MAXIMAS,
  VELOCIDADE_PONTO_MM_S,
  avaliarMedicoes,
  classificarMedicao,
  desvioDaDistancia,
  desvioDoPonto,
  distanciaDoDesvio,
  distanciaMaximaMensuravel,
  olhoParaMedir,
  sentidoDoPonto,
} from "./pontoCego";

describe("geometria do ponto cego", () => {
  it("usa os 13,5 graus do artigo", () => {
    expect(ANGULO_PONTO_CEGO_GRAUS).toBe(13.5);
  });

  it("a 50 cm o ponto some a ~12 cm do quadrado (tan 13,5° ≈ 0,24)", () => {
    expect(desvioDaDistancia(500)).toBeCloseTo(120.0, 0);
  });

  it("ida e volta: desvio -> distância -> desvio", () => {
    for (const d of [300, 450, 600, 1000]) expect(distanciaDoDesvio(desvioDaDistancia(d))).toBeCloseTo(d, 6);
  });

  it("um telemóvel ao alto não chega para medir a 40 cm; deitado chega", () => {
    // ~52 mm de percurso ao alto, ~125 mm deitado (telemóvel de 6,1 px/mm).
    expect(distanciaMaximaMensuravel(52)).toBeLessThan(400);
    expect(distanciaMaximaMensuravel(125)).toBeGreaterThan(500);
  });

  it("percurso negativo não dá distância negativa", () => {
    expect(distanciaMaximaMensuravel(-10)).toBe(0);
  });

  it("o ponto parte longe do quadrado e anda à velocidade definida", () => {
    expect(desvioDoPonto(0)).toBe(INICIO_PONTO_MM);
    expect(desvioDoPonto(2)).toBe(INICIO_PONTO_MM + 2 * VELOCIDADE_PONTO_MM_S);
    expect(desvioDoPonto(-1)).toBe(INICIO_PONTO_MM);
  });
});

describe("olho e sentido", () => {
  it("o ponto vai para o lado de fora do olho que vê", () => {
    expect(sentidoDoPonto("esquerdo")).toBe(-1);
    expect(sentidoDoPonto("direito")).toBe(1);
  });

  it("mede-se sempre com o olho que vê melhor", () => {
    expect(olhoParaMedir("esquerdo")).toBe("direito");
    expect(olhoParaMedir("direito")).toBe("esquerdo");
    expect(olhoParaMedir("nao_sei")).toBe("esquerdo");
    expect(olhoParaMedir(null)).toBe("esquerdo");
  });
});

describe("classificarMedicao", () => {
  it("rejeita toques cedo demais e valores impossíveis", () => {
    expect(classificarMedicao(DISTANCIA_MIN_MM - 1)).toBe("curta");
    expect(classificarMedicao(DISTANCIA_MAX_MM + 1)).toBe("longa");
    expect(classificarMedicao(550)).toBe("valida");
  });
});

describe("avaliarMedicoes", () => {
  it("precisa de pelo menos três medições", () => {
    expect(avaliarMedicoes([])).toEqual({ estado: "continuar" });
    expect(avaliarMedicoes([500, 510])).toEqual({ estado: "continuar" });
  });

  it("três que concordam dão a mediana, em mm inteiros", () => {
    expect(avaliarMedicoes([505, 498, 512.4])).toEqual({ estado: "concluida", distanciaMm: 505 });
  });

  it("um toque fora de tempo não estraga a medição", () => {
    expect(avaliarMedicoes([500, 820, 510, 495])).toEqual({ estado: "concluida", distanciaMm: 500 });
  });

  it("três que não concordam pedem mais medições", () => {
    expect(avaliarMedicoes([400, 500, 600])).toEqual({ estado: "continuar" });
  });

  it("sem acordo ao fim do máximo de medições, é inconsistente", () => {
    const espalhadas = [300, 420, 560, 700, 900];
    expect(espalhadas).toHaveLength(MEDICOES_MAXIMAS);
    expect(avaliarMedicoes(espalhadas)).toEqual({ estado: "inconsistente" });
  });

  it("aceita no limite dos 15% e recusa acima", () => {
    expect(avaliarMedicoes([500, 500, 575])).toEqual({ estado: "concluida", distanciaMm: 500 });
    expect(avaliarMedicoes([500, 500, 580])).toEqual({ estado: "continuar" });
  });
});
