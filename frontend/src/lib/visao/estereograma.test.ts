import { FORMAS, dentroDaForma, gerarEstereograma, gerarPares } from "./estereograma";

/** RNG determinista (LCG) para testes reprodutíveis. */
const rngFixo = (semente = 1) => {
  let s = semente;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
};

describe("estereograma", () => {
  it("as quatro formas contêm o centro e não contêm os cantos", () => {
    for (const f of FORMAS) {
      expect(dentroDaForma(f, 0, 0.1)).toBe(true);
      expect(dentroDaForma(f, 0.99, 0.99)).toBe(false);
    }
  });

  it("fora da forma, as duas imagens são iguais (o fundo não tem disparidade)", () => {
    const { esquerda, direita } = gerarPares({
      largura: 120,
      altura: 120,
      disparidade: 6,
      forma: "quadrado",
      tamanhoPonto: 2,
      rng: rngFixo(),
    });
    // canto superior esquerdo: longe da forma
    for (let y = 0; y < 15; y++) for (let x = 0; x < 15; x++) expect(esquerda[y * 120 + x]).toBe(direita[y * 120 + x]);
  });

  it("dentro da forma, o olho direito é o esquerdo deslocado pela disparidade", () => {
    const w = 120;
    const d = 6;
    const { esquerda, direita } = gerarPares({ largura: w, altura: w, disparidade: d, forma: "quadrado", tamanhoPonto: 2, rng: rngFixo(7) });
    // No centro da forma: direita[x] == esquerda[x + d]
    for (let x = 50; x < 70; x++) expect(direita[60 * w + x]).toBe(esquerda[60 * w + x + d]);
  });

  it("um olho sozinho não revela a forma: ~50% de pontos claros dentro e fora", () => {
    const w = 200;
    const { esquerda } = gerarPares({ largura: w, altura: w, disparidade: 4, forma: "circulo", tamanhoPonto: 1, rng: rngFixo(3) });
    let dentro = 0;
    let nDentro = 0;
    let fora = 0;
    let nFora = 0;
    for (let y = 0; y < w; y++)
      for (let x = 0; x < w; x++) {
        const na = dentroDaForma("circulo", (x - 100) / 64, (y - 100) / 64);
        if (na) {
          dentro += esquerda[y * w + x];
          nDentro++;
        } else {
          fora += esquerda[y * w + x];
          nFora++;
        }
      }
    expect(dentro / nDentro).toBeGreaterThan(0.4);
    expect(dentro / nDentro).toBeLessThan(0.6);
    expect(fora / nFora).toBeGreaterThan(0.4);
    expect(fora / nFora).toBeLessThan(0.6);
  });

  it("anáglifo: vermelho é o olho esquerdo, verde e azul o direito", () => {
    const px = gerarEstereograma({ largura: 10, altura: 10, disparidade: 2, forma: "circulo", tamanhoPonto: 1, rng: rngFixo(5) });
    for (let i = 0; i < 100; i++) {
      expect(px[i * 4 + 1]).toBe(px[i * 4 + 2]);
      expect(px[i * 4 + 3]).toBe(255);
    }
  });
});
