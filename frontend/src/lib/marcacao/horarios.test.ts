import { describe, expect, it } from "vitest";
import { agruparPorDia, chaveDoDia, formatarDiaCurto, formatarDiaLongo, formatarHora } from "./horarios";

// Segunda-feira, 5 de Outubro de 2026. 08:00Z = 09:00 em Luanda.
const H = (inicio: string) => ({ inicio, fim: inicio });

describe("horários na hora de Luanda", () => {
  it("formata a hora de Luanda, seja qual for o fuso do aparelho", () => {
    expect(formatarHora("2026-10-05T08:00:00Z", "pt-AO")).toBe("09:00");
    expect(formatarHora("2026-10-05T09:00:00+01:00", "pt-AO")).toBe("09:00");
  });

  it("o dia é o de Luanda: 23:30 UTC de domingo já é segunda em Luanda", () => {
    expect(chaveDoDia("2026-10-04T23:30:00Z")).toBe("2026-10-05");
  });

  it("agrupa por dia, por ordem, sem perder nenhum horário", () => {
    const dias = agruparPorDia([
      H("2026-10-06T08:00:00Z"),
      H("2026-10-05T08:30:00Z"),
      H("2026-10-05T08:00:00Z"),
      H("2026-10-04T23:30:00Z"),
    ]);
    expect(dias.map((d) => d.chave)).toEqual(["2026-10-05", "2026-10-06"]);
    expect(dias[0]!.horarios.map((h) => formatarHora(h.inicio, "pt-AO"))).toEqual(["00:30", "09:00", "09:30"]);
    expect(dias.flatMap((d) => d.horarios)).toHaveLength(4);
  });

  it("os nomes dos dias seguem o idioma", () => {
    expect(formatarDiaLongo("2026-10-05T08:00:00Z", "pt-AO")).toMatch(/segunda-feira, 5 de outubro/);
    expect(formatarDiaLongo("2026-10-05T08:00:00Z", "en-US")).toMatch(/Monday, October 5/);
    expect(formatarDiaCurto("2026-10-05T08:00:00Z", "pt-AO").data).toBe("05/10");
  });
});
