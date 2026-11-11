import { minutosDeLeitura, PALAVRAS_POR_MINUTO } from "./leitura";

describe("minutosDeLeitura", () => {
  it("nunca é menos de 1 minuto, mesmo sem texto", () => {
    expect(minutosDeLeitura("")).toBe(1);
    expect(minutosDeLeitura("uma frase curta")).toBe(1);
  });

  it("arredonda para cima", () => {
    const palavras = (n: number) => Array.from({ length: n }, () => "olho").join(" ");
    expect(minutosDeLeitura(palavras(PALAVRAS_POR_MINUTO))).toBe(1);
    expect(minutosDeLeitura(palavras(PALAVRAS_POR_MINUTO + 1))).toBe(2);
    expect(minutosDeLeitura(palavras(PALAVRAS_POR_MINUTO * 4))).toBe(4);
  });

  it("ignora espaços e quebras de linha repetidos", () => {
    expect(minutosDeLeitura("  a\n\n b   c ")).toBe(1);
  });
});
