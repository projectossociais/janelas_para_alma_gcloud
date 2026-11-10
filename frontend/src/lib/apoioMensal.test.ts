import { formatarKz, lerValorMensal, VALOR_MENSAL_MAXIMO_KZ, VALOR_MENSAL_MINIMO_KZ } from "./apoioMensal";

describe("lerValorMensal", () => {
  it.each([
    ["10000", 10000],
    ["10.000", 10000],
    ["10 000", 10000],
    ["10.000 Kz", 10000],
    ["  2500kz ", 2500],
  ])("lê %j como %i Kz", (texto, valor) => {
    expect(lerValorMensal(texto)).toBe(valor);
  });

  it.each(["", "abc", "10,5", "-5000", "1.000,50"])("recusa %j", (texto) => {
    expect(lerValorMensal(texto)).toBeNull();
  });

  it("recusa abaixo do mínimo e acima do máximo", () => {
    expect(lerValorMensal(String(VALOR_MENSAL_MINIMO_KZ - 1))).toBeNull();
    expect(lerValorMensal(String(VALOR_MENSAL_MINIMO_KZ))).toBe(VALOR_MENSAL_MINIMO_KZ);
    expect(lerValorMensal(String(VALOR_MENSAL_MAXIMO_KZ + 1))).toBeNull();
  });
});

describe("formatarKz", () => {
  it("usa o ponto como separador de milhar, também em valores de 4 dígitos", () => {
    expect(formatarKz(5000)).toBe("5.000 Kz");
    expect(formatarKz(15000)).toBe("15.000 Kz");
    expect(formatarKz(1250000)).toBe("1.250.000 Kz");
    expect(formatarKz(950)).toBe("950 Kz");
  });
});
