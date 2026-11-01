import { describe, expect, it } from "vitest";
import { achadoDoReflexo, concordam, desvioMaximo, desvioPeloTapar, reflexoNoDesenho } from "./luzOlhos";

describe("o pontinho de luz (Hirschberg)", () => {
  it("as quatro posições valem cerca de 15, 30, 60 e 90 Δ", () => {
    expect(achadoDoReflexo("esquerdo", "orelha", "pouco").delta).toBe(15);
    expect(achadoDoReflexo("esquerdo", "orelha", "pupila").delta).toBe(30);
    expect(achadoDoReflexo("esquerdo", "orelha", "meio").delta).toBe(60);
    expect(achadoDoReflexo("esquerdo", "orelha", "iris").delta).toBe(90);
  });

  it("pontinho para a orelha: olho virado para dentro; para o nariz: para fora", () => {
    expect(achadoDoReflexo("esquerdo", "orelha", "pupila")).toEqual({ olho: "esquerdo", sentido: "dentro", mm: 2, delta: 30 });
    expect(achadoDoReflexo("direito", "nariz", "pouco")).toMatchObject({ olho: "direito", sentido: "fora" });
  });

  it("pontinho para cima: olho virado para baixo, e vice-versa", () => {
    expect(achadoDoReflexo("direito", "cima", "pouco").sentido).toBe("baixo");
    expect(achadoDoReflexo("direito", "baixo", "pouco").sentido).toBe("cima");
  });

  it("no desenho, de frente: a orelha esquerda dela fica à direita de quem vê", () => {
    expect(reflexoNoDesenho("esquerdo", "orelha", 2)).toEqual({ x: 2, y: 0 });
    expect(reflexoNoDesenho("direito", "orelha", 2)).toEqual({ x: -2, y: 0 });
    expect(reflexoNoDesenho("direito", "nariz", 2)).toEqual({ x: 2, y: 0 });
    expect(reflexoNoDesenho("esquerdo", "cima", 1)).toEqual({ x: 0, y: -1 });
  });

  it("o desvio máximo é o maior dos achados", () => {
    expect(desvioMaximo([achadoDoReflexo("direito", "nariz", "meio")])).toBe(60);
    expect(desvioMaximo([])).toBe(0);
  });
});

describe("teste de tapar", () => {
  it("o olho que se mexe para o nariz estava virado para fora", () => {
    expect(desvioPeloTapar({ esquerdo: "dentro", direito: "nao" })).toEqual([{ olho: "esquerdo", sentido: "fora" }]);
  });

  it("para a orelha: estava virado para dentro; para cima: estava para baixo", () => {
    expect(desvioPeloTapar({ direito: "fora", esquerdo: "cima" })).toEqual([
      { olho: "direito", sentido: "dentro" },
      { olho: "esquerdo", sentido: "baixo" },
    ]);
  });

  it("'não se mexeu' e 'não consegui ver' não são desvio", () => {
    expect(desvioPeloTapar({ direito: "nao", esquerdo: "naovi" })).toEqual([]);
  });

  it("a luz e o tapar concordam quando apontam o mesmo olho para o mesmo lado", () => {
    const luz = [achadoDoReflexo("esquerdo", "orelha", "pupila")];
    expect(concordam(luz, desvioPeloTapar({ esquerdo: "fora" }))).toBe(true);
    expect(concordam(luz, desvioPeloTapar({ direito: "fora" }))).toBe(false);
  });
});
