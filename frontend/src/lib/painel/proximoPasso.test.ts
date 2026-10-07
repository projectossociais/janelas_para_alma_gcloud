import { describe, expect, it } from "vitest";
import { proximoPasso, type EstadoDoPainel } from "./proximoPasso";

const base: EstadoDoPainel = {
  temTeleconsulta: false,
  ultimoRastreio: { id: "r1", diagnostico: "normal" },
  exerciciosDisponiveis: 0,
  estadoAcesso: "trial_terminado",
};
const com = (o: Partial<EstadoDoPainel>) => proximoPasso({ ...base, ...o });

describe("proximoPasso", () => {
  it("uma teleconsulta marcada ganha a tudo", () => {
    const r = com({ temTeleconsulta: true, ultimoRastreio: null, exerciciosDisponiveis: 4 });
    expect(r).toEqual({ tipo: "teleconsulta" });
  });

  it("o último rastreio pediu avaliação: marcar consulta, ligada a esse rastreio", () => {
    expect(com({ ultimoRastreio: { id: "r9", diagnostico: "requer_avaliacao" }, exerciciosDisponiveis: 4 })).toEqual({
      tipo: "marcar-consulta",
      rastreioId: "r9",
    });
  });

  it("nunca fez um rastreio: o primeiro rastreio, antes de qualquer treino", () => {
    expect(com({ ultimoRastreio: null, exerciciosDisponiveis: 8 })).toEqual({ tipo: "primeiro-rastreio" });
  });

  it("o último rastreio não mediu: repetir, nunca dá como feito", () => {
    expect(com({ ultimoRastreio: { id: "r2", diagnostico: "inconclusivo" }, exerciciosDisponiveis: 8 })).toEqual({
      tipo: "repetir-rastreio",
    });
  });

  it("com exercícios abertos e sem nada urgente: continuar os treinos", () => {
    expect(com({ exerciciosDisponiveis: 4, estadoAcesso: "trial_ativo" })).toEqual({ tipo: "treinar" });
    expect(com({ exerciciosDisponiveis: 8, estadoAcesso: "premium" })).toEqual({ tipo: "treinar" });
  });

  it("sem exercícios abertos mas com o teste de 7 dias por usar: começá-lo", () => {
    expect(com({ estadoAcesso: "trial_disponivel" })).toEqual({ tipo: "teste-7-dias" });
  });

  it("sem exercícios e sem teste por usar: o Premium", () => {
    expect(com({ estadoAcesso: "trial_terminado" })).toEqual({ tipo: "premium" });
  });
});
