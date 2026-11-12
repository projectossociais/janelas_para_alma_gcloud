import { describe, expect, it } from "vitest";
import { eVideoDaGaleria, partirEmLinks } from "./midiaPublicacao";

describe("eVideoDaGaleria", () => {
  it("reconhece MP4 e WebM, também com query string", () => {
    expect(eVideoDaGaleria("https://cdn.test/publicacoes/p/a.mp4")).toBe(true);
    expect(eVideoDaGaleria("https://cdn.test/publicacoes/p/a.WEBM?v=1")).toBe(true);
  });

  it("fotos não são vídeo", () => {
    expect(eVideoDaGaleria("https://cdn.test/publicacoes/p/a.jpg")).toBe(false);
    expect(eVideoDaGaleria("https://cdn.test/mp4/a.png")).toBe(false);
  });
});

describe("partirEmLinks", () => {
  it("separa o link do texto, sem levar a pontuação final", () => {
    expect(partirEmLinks("Inscreva-se: https://exemplo.test/form?a=1.\nObrigado")).toEqual([
      { tipo: "texto", valor: "Inscreva-se: " },
      { tipo: "link", valor: "https://exemplo.test/form?a=1" },
      { tipo: "texto", valor: ".\nObrigado" },
    ]);
  });

  it("texto sem links fica igual", () => {
    expect(partirEmLinks("só texto")).toEqual([{ tipo: "texto", valor: "só texto" }]);
  });

  it("não trata javascript: como link", () => {
    expect(partirEmLinks("javascript:alert(1)")).toEqual([{ tipo: "texto", valor: "javascript:alert(1)" }]);
  });
});
