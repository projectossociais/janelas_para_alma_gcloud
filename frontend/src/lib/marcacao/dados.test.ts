import { describe, expect, it } from "vitest";
import { validarContacto } from "./dados";

const OK = { nome: "Ana Silva", email: "ana@exemplo.ao", telefone: "+244 923 000 000", motivo: "" };

describe("validarContacto", () => {
  it("dados válidos não têm erros", () => {
    expect(validarContacto(OK)).toEqual({});
    expect(validarContacto({ ...OK, telefone: "923000000" })).toEqual({});
    expect(validarContacto({ ...OK, telefone: "(+244) 923-000-000" })).toEqual({});
  });

  it("nome com menos de 2 letras (depois de tirar espaços)", () => {
    expect(validarContacto({ ...OK, nome: " A " }).nome).toBe("nomeCurto");
  });

  it("email sem @ ou sem domínio", () => {
    expect(validarContacto({ ...OK, email: "ana" }).email).toBe("emailInvalido");
    expect(validarContacto({ ...OK, email: "ana@exemplo" }).email).toBe("emailInvalido");
  });

  it("telefone com poucos algarismos ou com letras", () => {
    expect(validarContacto({ ...OK, telefone: "92300" }).telefone).toBe("telefoneInvalido");
    expect(validarContacto({ ...OK, telefone: "923 abc 000" }).telefone).toBe("telefoneInvalido");
  });

  it("motivo acima de 500 caracteres", () => {
    expect(validarContacto({ ...OK, motivo: "x".repeat(501) }).motivo).toBe("motivoLongo");
  });
});
