import { describe, it, expect } from "vitest";
import { erroDePasswordFraca } from "./validarPassword";

describe("erroDePasswordFraca", () => {
  it("aceita uma password com letra, número e comprimento suficiente", () => {
    expect(erroDePasswordFraca("password123")).toBeNull();
  });

  it("recusa uma password demasiado curta", () => {
    expect(erroDePasswordFraca("abc123")).toMatch(/pelo menos 8 caracteres/);
  });

  it("recusa uma password só com números", () => {
    expect(erroDePasswordFraca("12345678")).toMatch(/pelo menos uma letra/);
  });

  it("recusa uma password só com letras", () => {
    expect(erroDePasswordFraca("abcdefgh")).toMatch(/pelo menos um número/);
  });
});
