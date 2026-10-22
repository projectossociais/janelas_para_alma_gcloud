import { describe, expect, it } from "vitest";
import {
  FORMAS_PANO,
  GRELHA_PANO,
  QUADRO_PANO_MM,
  alargarRampa,
  dentroDaFormaPano,
  gerarParPano,
  guardarModoOlhoMagico,
  lerModoOlhoMagico,
  mascaraPano,
  niveisOlhoMagico,
  niveisQueCabem,
  sentidoDoModo,
} from "./olhoMagico";
import { iniciarRampa, responderRampa, separacaoMm } from "./pontes";

/** Gerador determinista (Park-Miller), para os testes não dependerem da sorte. */
const rngFixo = (semente = 7) => {
  let s = semente;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
};

describe("formas", () => {
  it("cada forma ocupa uma boa parte do quadro, sem tocar nas bordas", () => {
    for (const f of FORMAS_PANO) {
      const m = mascaraPano(f);
      const area = m.reduce((a, b) => a + b, 0) / m.length;
      expect(area).toBeGreaterThan(0.15);
      expect(area).toBeLessThan(0.6);
      for (let i = 0; i < GRELHA_PANO; i++) {
        expect(m[i]).toBe(0); // primeira linha
        expect(m[i * GRELHA_PANO]).toBe(0); // primeira coluna
      }
    }
  });

  it("as quatro formas são diferentes entre si", () => {
    const ms = FORMAS_PANO.map((f) => mascaraPano(f).join(""));
    expect(new Set(ms).size).toBe(4);
  });

  it("pontos claramente dentro e fora", () => {
    expect(dentroDaFormaPano("peixe", 0.56, 0.5)).toBe(true);
    expect(dentroDaFormaPano("estrela", 0.5, 0.54)).toBe(true);
    expect(dentroDaFormaPano("coracao", 0.5, 0.5)).toBe(true);
    expect(dentroDaFormaPano("casa", 0.5, 0.3)).toBe(true);
    for (const f of FORMAS_PANO) expect(dentroDaFormaPano(f, 0.02, 0.02)).toBe(false);
  });
});

describe("par de quadros", () => {
  it("cada quadro sozinho não mostra a forma: só a diferença entre os dois a desenha", () => {
    const n = GRELHA_PANO;
    const { esquerdo, direito } = gerarParPano("estrela", rngFixo(), n, 3);
    const m = mascaraPano("estrela", n);
    // Fora da forma e da faixa que ela ocupa no outro quadro, os dois são iguais ponto a ponto.
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const i = y * n + x;
        const naForma = m[i] || (x + 3 < n && m[i + 3]);
        if (!naForma) expect(direito[i]).toBe(esquerdo[i]);
      }
    let dentroIguais = 0;
    let dentro = 0;
    for (let i = 0; i < m.length; i++)
      if (m[i]) {
        dentro++;
        if (esquerdo[i] === direito[i]) dentroIguais++;
      }
    // Dentro, quase tudo muda (só coincide por acaso, ~1 em 6 cores).
    expect(dentroIguais / dentro).toBeLessThan(0.35);
  });

  it("no quadro do olho direito, a forma está deslocada para a esquerda", () => {
    const n = GRELHA_PANO;
    const { esquerdo, direito } = gerarParPano("casa", rngFixo(), n, 3);
    const m = mascaraPano("casa", n);
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n - 3; x++) if (m[y * n + x + 3]) expect(direito[y * n + x]).toBe(esquerdo[y * n + x + 3]);
  });
});

describe("degraus", () => {
  it("o primeiro degrau é o mais perto que os quadros podem estar", () => {
    const n = niveisOlhoMagico("convergencia", 400);
    expect(n[0]).toBe(5.5); // (20 + 2) mm a 400 mm = 5,5 Δ
    expect(separacaoMm(n[0], 400)).toBeGreaterThanOrEqual(QUADRO_PANO_MM + 2);
    expect(n[1]).toBeGreaterThanOrEqual(n[0] + 1);
    expect([...n].sort((a, b) => a - b)).toEqual(n);
  });

  it("mais perto, o primeiro degrau pede mais Δ", () => {
    expect(niveisOlhoMagico("divergencia", 300)[0]).toBeGreaterThan(niveisOlhoMagico("divergencia", 500)[0]);
  });

  it("ao alto (60 mm) cabem poucos degraus; deitado (130 mm), muitos mais", () => {
    const n = niveisOlhoMagico("convergencia", 400);
    expect(niveisQueCabem(n, 400, 60).length).toBeLessThan(4);
    expect(niveisQueCabem(n, 400, 130).length).toBeGreaterThan(8);
  });

  it("modo -> sentido", () => {
    expect(sentidoDoModo("cruzar")).toBe("convergencia");
    expect(sentidoDoModo("relaxar")).toBe("divergencia");
  });
});

describe("rodar o telemóvel a meio da rampa", () => {
  it("continua um degrau acima, sem perder a rampa", () => {
    let e = iniciarRampa(2);
    e = responderRampa(e, true); // degrau 1, o último que cabe ao alto
    const alargada = alargarRampa(e, 10);
    expect(alargada.total).toBe(10);
    expect(alargada.indice).toBe(2);
    expect(alargada.terminado).toBe(false);
  });

  it("sem degraus novos, ou já a descer, não muda nada", () => {
    const e = responderRampa(iniciarRampa(3), true);
    expect(alargarRampa(e, 2)).toBe(e);
    const descer = { ...e, fase: "descer" as const };
    expect(alargarRampa(descer, 10)).toBe(descer);
  });
});

describe("modo guardado", () => {
  it("por omissão cruzar; guarda e lê", () => {
    window.localStorage.clear();
    expect(lerModoOlhoMagico()).toBe("cruzar");
    guardarModoOlhoMagico("relaxar");
    expect(lerModoOlhoMagico()).toBe("relaxar");
    window.localStorage.clear();
  });
});
