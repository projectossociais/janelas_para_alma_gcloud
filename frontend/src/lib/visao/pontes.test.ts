import { describe, expect, it } from "vitest";
import {
  NIVEIS_DELTA,
  deltaDaSeparacao,
  gerarPonte,
  gerarPonteBits,
  iniciarRampa,
  niveisMostraveis,
  guardarEscolhaSentidos,
  lerEscolhaSentidos,
  passouVerificacao,
  sentidosDaEscolha,
  rampaEmDelta,
  responderRampa,
  resumirRampas,
  separacaoMm,
  type EstadoRampa,
  type OpcoesPonte,
} from "./pontes";

describe("dioptrias prismáticas", () => {
  it("12 mm de separação a 40 cm são 3 Δ", () => {
    expect(deltaDaSeparacao(12, 400)).toBeCloseTo(3, 10);
    expect(separacaoMm(3, 400)).toBeCloseTo(12, 10);
  });

  it("a mesma procura pede mais separação mais longe", () => {
    expect(separacaoMm(10, 600)).toBeGreaterThan(separacaoMm(10, 400));
  });

  it("só ficam os degraus que cabem no palco", () => {
    // 140 mm de palco a 40 cm: 140 - 30 (anel) - 8 (margens) = 102 mm -> até 25 Δ.
    const niveis = niveisMostraveis(NIVEIS_DELTA.convergencia, 400, 140);
    expect(niveis.at(-1)).toBe(25);
    // Um telemóvel ao alto (64 mm) quase só deixa os anéis sobrepostos.
    expect(niveisMostraveis(NIVEIS_DELTA.convergencia, 400, 64).at(-1)).toBeLessThanOrEqual(6);
  });
});

/** Responde a uma sequência e devolve o estado final. */
const correr = (total: number, respostas: boolean[]): EstadoRampa =>
  respostas.reduce((e, r) => responderRampa(e, r), iniciarRampa(total));

describe("rampa de rotura e recuperação", () => {
  it("sobe um degrau por resposta certa", () => {
    expect(correr(10, [true, true, true]).indice).toBe(3);
  });

  it("um erro sozinho não é rotura", () => {
    const e = correr(10, [true, true, false, true]);
    expect(e.fase).toBe("subir");
    expect(e.indice).toBe(3);
  });

  it("dois erros seguidos marcam a rotura nesse degrau e começa a descer", () => {
    const e = correr(10, [true, true, true, false, false]);
    expect(e.rotura).toBe(3);
    expect(e.fase).toBe("descer");
    expect(e.indice).toBe(2);
  });

  it("a recuperação pede duas certas seguidas no mesmo degrau", () => {
    const desce = [true, true, true, true, false, false]; // rotura no 4, desce para o 3
    let e = correr(10, [...desce, true]);
    expect(e.terminado).toBe(false);
    e = responderRampa(e, true);
    expect(e.terminado).toBe(true);
    expect(e.recuperacao).toBe(3);
  });

  it("a descer, um erro desce mais um degrau", () => {
    const e = correr(10, [true, true, true, true, false, false, false]);
    expect(e.indice).toBe(2);
    expect(e.recuperacao).toBeNull();
  });

  it("se não recupera nem a 0, termina sem recuperação", () => {
    const e = correr(10, [true, false, false, false]);
    expect(e.rotura).toBe(1);
    expect(e.terminado).toBe(true);
    expect(e.recuperacao).toBeNull();
  });

  it("aguentar até ao último degrau é limite do ecrã, não rotura", () => {
    const e = correr(4, [true, true, true, true]);
    expect(e.terminado).toBe(true);
    expect(e.atingiuLimite).toBe(true);
    expect(e.rotura).toBeNull();
  });

  it("depois de terminar, as respostas não mudam nada", () => {
    const e = correr(4, [true, true, true, true]);
    expect(responderRampa(e, false)).toBe(e);
  });

  it("converte para Δ com os degraus usados", () => {
    const niveis = [0, 2, 4, 6, 8];
    const e = correr(niveis.length, [true, true, true, false, false, true, true]);
    expect(rampaEmDelta(e, niveis)).toEqual({ rotura: 6, recuperacao: 4, limiteEcra: false, maximo: 8 });
  });
});

describe("resumirRampas", () => {
  it("medianas das roturas e das recuperações", () => {
    const r = resumirRampas([
      { rotura: 18, recuperacao: 12, limiteEcra: false, maximo: 25 },
      { rotura: 22, recuperacao: 14, limiteEcra: false, maximo: 25 },
      { rotura: 16, recuperacao: null, limiteEcra: false, maximo: 25 },
    ]);
    expect(r).toEqual({ rampas: 3, semFusao: 0, rotura: 18, recuperacao: 13, limiteEcra: false, maximo: 25 });
  });

  it("rampas que rompem a 0 Δ contam à parte e não puxam a mediana para baixo", () => {
    const r = resumirRampas([
      { rotura: 0, recuperacao: null, limiteEcra: false, maximo: 25 },
      { rotura: 14, recuperacao: 8, limiteEcra: false, maximo: 25 },
    ]);
    expect(r).toMatchObject({ rampas: 2, semFusao: 1, rotura: 14, recuperacao: 8 });
  });

  it("a recuperação nunca fica acima da rotura", () => {
    const r = resumirRampas([
      { rotura: 6, recuperacao: 4, limiteEcra: false, maximo: 25 },
      { rotura: 8, recuperacao: null, limiteEcra: false, maximo: 25 },
      { rotura: 4, recuperacao: 4, limiteEcra: true, maximo: 25 },
      { rotura: null, recuperacao: 12, limiteEcra: true, maximo: 25 },
    ]);
    expect(r.rotura).toBe(6);
    expect(r.recuperacao).toBeLessThanOrEqual(r.rotura as number);
  });

  it("sem roturas medidas, rotura nula e o limite do ecrã fica marcado", () => {
    const r = resumirRampas([{ rotura: null, recuperacao: null, limiteEcra: true, maximo: 25 }]);
    expect(r.rotura).toBeNull();
    expect(r.limiteEcra).toBe(true);
  });
});

describe("sentidos", () => {
  it("'ambos' alterna convergência e divergência; os outros, só um", () => {
    expect(sentidosDaEscolha("ambos")).toEqual(["convergencia", "divergencia"]);
    expect(sentidosDaEscolha("divergencia")).toEqual(["divergencia"]);
  });

  it("guarda a escolha por aparelho, com 'ambos' por omissão", () => {
    window.localStorage.clear();
    expect(lerEscolhaSentidos()).toBe("ambos");
    guardarEscolhaSentidos("divergencia");
    expect(lerEscolhaSentidos()).toBe("divergencia");
    window.localStorage.setItem("jpa.visao.pontes.sentidos", "lixo");
    expect(lerEscolhaSentidos()).toBe("ambos");
    window.localStorage.clear();
  });
});

describe("verificação a 0 Δ", () => {
  it("duas certas em três", () => {
    expect(passouVerificacao(2)).toBe(true);
    expect(passouVerificacao(1)).toBe(false);
  });
});

describe("gerarPonteBits", () => {
  const base: OpcoesPonte = {
    largura: 300,
    altura: 120,
    lado: 100,
    espessuraAnel: 6,
    separacao: 0,
    sentido: "convergencia",
    disparidadeForma: 4,
    forma: "circulo",
    tamanhoPonto: 2,
    rng: () => 0.2, // sem pontos escuros: só o anel fica escuro
  };

  /** Colunas da linha do meio que estão escuras num olho. */
  const colunasEscuras = (bits: Uint8Array, largura: number, altura: number) => {
    const y = Math.floor(altura / 2);
    const xs: number[] = [];
    for (let x = 0; x < largura; x++) if (bits[y * largura + x] === 0) xs.push(x);
    return xs;
  };
  const centro = (xs: number[]) => (xs[0] + xs[xs.length - 1]) / 2;

  it("a 0 Δ os dois anéis estão no mesmo sítio", () => {
    const { esquerda, direita } = gerarPonteBits(base);
    expect(centro(colunasEscuras(esquerda, 300, 120))).toBe(centro(colunasEscuras(direita, 300, 120)));
  });

  it("na convergência, a imagem do olho esquerdo vai para a direita", () => {
    const { esquerda, direita } = gerarPonteBits({ ...base, separacao: 40 });
    const ce = centro(colunasEscuras(esquerda, 300, 120));
    const cd = centro(colunasEscuras(direita, 300, 120));
    expect(ce - cd).toBe(40);
  });

  it("na divergência, ao contrário", () => {
    const { esquerda, direita } = gerarPonteBits({ ...base, separacao: 40, sentido: "divergencia" });
    expect(centro(colunasEscuras(direita, 300, 120)) - centro(colunasEscuras(esquerda, 300, 120))).toBe(40);
  });

  it("fora dos anéis, os dois olhos vêem fundo claro", () => {
    const { esquerda, direita } = gerarPonteBits(base);
    expect(esquerda[0]).toBe(1);
    expect(direita[0]).toBe(1);
  });

  it("dentro do anel, cada olho vê ruído; a forma só existe entre os dois", () => {
    let semente = 1;
    const rng = () => ((semente = (semente * 16807) % 2147483647) / 2147483647);
    const { esquerda, direita } = gerarPonteBits({ ...base, rng });
    // Pontos dos dois olhos diferem só onde a forma está deslocada.
    let diferentes = 0;
    for (let i = 0; i < esquerda.length; i++) if (esquerda[i] !== direita[i]) diferentes++;
    expect(diferentes).toBeGreaterThan(0);
    // ...e em cada olho há pontos claros e escuros dentro do anel (ruído).
    const meio = 60 * 300 + 150;
    const amostra = Array.from({ length: 20 }, (_, i) => esquerda[meio - 10 + i]);
    expect(new Set(amostra).size).toBe(2);
  });

  it("gerarPonte usa as quatro cores do anáglifo", () => {
    const px = gerarPonte({ ...base, separacao: 40 });
    expect(px.length).toBe(300 * 120 * 4);
    expect(px[3]).toBe(255);
  });
});
