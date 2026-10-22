import { describe, expect, it } from "vitest";
import { ZERO_REGUA_PX, classeDoPpc, cmNaRegua, linhasDoFio, resumirFio } from "./fioMissangas";

describe("régua no ecrã", () => {
  it("a 6 píxeis por mm, 60 px abaixo do zero são 1 cm", () => {
    expect(cmNaRegua(ZERO_REGUA_PX + 60, 6)).toBe(1);
    expect(cmNaRegua(ZERO_REGUA_PX + 6 * 83, 6)).toBe(8.5); // 8,3 cm -> meio centímetro mais perto
  });

  it("acima do zero conta como 0", () => {
    expect(cmNaRegua(0, 6)).toBe(0);
  });
});

describe("resumo do fio", () => {
  it("um fio só em alguma missanga é supressão", () => {
    expect(resumirFio(["x", "um", "depois"], [8, 8]).supressao).toBe(true);
    expect(resumirFio(["x", "x", "x"], [5, 6]).supressao).toBe(false);
  });

  it("PPC: média das duas medições e a classe", () => {
    expect(resumirFio(["x", "x", "x"], [5, 6])).toMatchObject({ ppcCm: 5.5, classe: "esperado", xNoSitio: 3, alemDaRegua: false });
    expect(resumirFio(["x"], [8, 9]).classe).toBe("limite");
    expect(resumirFio(["x"], [12, 11]).classe).toBe("alto");
  });

  it("uma medição para lá da régua: sem média, conta como acima", () => {
    expect(resumirFio(["x"], [7, null])).toMatchObject({ ppcCm: null, alemDaRegua: true, classe: "alto" });
  });

  it("limites das classes", () => {
    expect(classeDoPpc(6)).toBe("esperado");
    expect(classeDoPpc(10)).toBe("limite");
    expect(classeDoPpc(10.5)).toBe("alto");
    expect(classeDoPpc(null)).toBe("alto");
  });
});

describe("desenho das respostas", () => {
  it("em X na missanga, os dois fios cruzam-se à altura dela (y = 46, x = 36)", () => {
    const [a, b] = linhasDoFio("x");
    const xEm = (l: typeof a, y: number) => l.x1 + ((l.x2 - l.x1) * (l.y1 - y)) / (l.y1 - l.y2);
    expect(xEm(a, 46)).toBeCloseTo(36, 5);
    expect(xEm(b, 46)).toBeCloseTo(36, 5);
  });

  it("um fio só, uma linha", () => {
    expect(linhasDoFio("um")).toHaveLength(1);
  });
});
