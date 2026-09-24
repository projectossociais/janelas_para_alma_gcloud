import { describe, it, expect } from "vitest";
import { formatarTempoRestante, msRestantes, nivelDeCerteza } from "./mercadoConfig";

describe("formatarTempoRestante", () => {
  it("formata 4 horas certas", () => {
    expect(formatarTempoRestante(4 * 3600 * 1000)).toBe("04:00:00");
  });

  it("formata horas, minutos e segundos com dois dígitos", () => {
    expect(formatarTempoRestante((3 * 3600 + 5 * 60 + 9) * 1000)).toBe("03:05:09");
  });

  it("arredonda para cima -- nunca mostra 00:00:00 com o bloqueio ainda activo", () => {
    expect(formatarTempoRestante(1)).toBe("00:00:01");
    expect(formatarTempoRestante(59_001)).toBe("00:01:00");
  });

  it("zero e negativos dão 00:00:00", () => {
    expect(formatarTempoRestante(0)).toBe("00:00:00");
    expect(formatarTempoRestante(-5000)).toBe("00:00:00");
  });
});

describe("msRestantes", () => {
  const disponivel = "2026-09-24T16:00:00Z";
  const quatroHorasAntes = Date.parse("2026-09-24T12:00:00Z");

  it("sem bloqueio, não falta nada", () => {
    expect(msRestantes(null, quatroHorasAntes, 0)).toBe(0);
  });

  it("mede o tempo que falta com o relógio do dispositivo certo", () => {
    expect(msRestantes(disponivel, quatroHorasAntes, 0)).toBe(4 * 3600 * 1000);
  });

  it("corrige um dispositivo com o relógio atrasado 1 hora", () => {
    // O dispositivo pensa que são 11:00; o servidor disse 12:00 (desvio +1h).
    const dispositivo = Date.parse("2026-09-24T11:00:00Z");
    expect(msRestantes(disponivel, dispositivo, 3600 * 1000)).toBe(4 * 3600 * 1000);
  });

  it("depois de passar a hora, é zero -- nunca negativo", () => {
    expect(msRestantes(disponivel, Date.parse("2026-09-24T17:00:00Z"), 0)).toBe(0);
  });
});

describe("nivelDeCerteza", () => {
  it.each([
    [0.5, "baixa"],
    [0.7, "media"],
    [0.85, "alta"],
    [0.95, "muitoAlta"],
  ] as const)("%s -> %s", (precisao, nivel) => {
    expect(nivelDeCerteza(precisao)).toBe(nivel);
  });
});
