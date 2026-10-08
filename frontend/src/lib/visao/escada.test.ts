import {
  direccaoAleatoria,
  escolhaAleatoria,
  iniciarEscadaTeste,
  iniciarEscadaTreino,
  INVERSOES_MINIMAS,
  limiarFinoTeste,
  limiarTreino,
  responderTeste,
  responderTreino,
  valorNoIndice,
  type Direccao,
  type EstadoEscadaTeste,
  type EstadoEscadaTreino,
} from "./escada";

const responderVarias = (e: EstadoEscadaTeste, respostas: boolean[]) =>
  respostas.reduce((acc, r) => responderTeste(acc, r), e);

/** Observador simulado: acerta sempre até ao índice `limite`, erra depois. */
function simularTeste(total: number, inicio: number, limite: number) {
  let e = iniciarEscadaTeste(total, inicio);
  let guarda = 0;
  while (!e.terminado && guarda++ < 200) e = responderTeste(e, e.indice <= limite);
  return e;
}

describe("escada do teste", () => {
  // Caso real (2026-10-08): os dois olhos passaram os mesmos níveis, um com
  // menos erros, e o resultado foi igual -- só contava o último nível passado.
  // Contagem anel a anel (como a ETDRS): cada erro no último nível passado
  // piora 1/3 de nível; cada acerto no primeiro falhado melhora 1/3.
  describe("contagem anel a anel (limiarFinoTeste)", () => {
    const LOGMAR = [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.0, -0.1];

    it("mesmos níveis, menos erros: resultado melhor (logMAR mais baixo)", () => {
      // Olho A: 0,7 ✓✓ · 0,6 ✓✓ · 0,5 ✓✗✗ -> 0,6 - 1/3 de nível
      const a = responderVarias(iniciarEscadaTeste(12, 3), [true, true, true, true, true, false, false]);
      // Olho B: 0,7 ✓✓ · 0,6 ✓✗✓ · 0,5 ✗✗   -> 0,6 + 1/3 de nível
      const b = responderVarias(iniciarEscadaTeste(12, 3), [true, true, true, false, true, false, false]);
      expect(a.terminado && b.terminado).toBe(true);
      expect(a.limiar).toBe(4);
      expect(b.limiar).toBe(4); // o mesmo nível: era aqui que davam igual
      expect(limiarFinoTeste(a, LOGMAR)).toBeCloseTo(0.6 - 0.1 / 3, 6);
      expect(limiarFinoTeste(b, LOGMAR)).toBeCloseTo(0.6 + 0.1 / 3, 6);
    });

    it("sem erros no nível passado e nenhum acerto no seguinte: o valor do nível", () => {
      const e = responderVarias(iniciarEscadaTeste(12, 3), [true, true, true, true, false, false]);
      expect(limiarFinoTeste(e, LOGMAR)).toBeCloseTo(0.6, 6);
    });

    it("não leu nem o maior: continua null", () => {
      const e = responderVarias(iniciarEscadaTeste(12, 0), [false, false]);
      expect(e.limiar).toBeNull();
      expect(limiarFinoTeste(e, LOGMAR)).toBeNull();
    });

    it("passou o mais pequeno que o ecrã mostra: só os erros desse nível contam", () => {
      const e = responderVarias(iniciarEscadaTeste(3, 1), [true, true, true, false, true]);
      expect(e.atingiuLimite).toBe(true);
      expect(limiarFinoTeste(e, [0.2, 0.1, 0.0])).toBeCloseTo(0.0 + 0.1 / 3, 6);
    });

    it("serve para qualquer escala (contraste: valores crescem com a dificuldade)", () => {
      const LOG_CS = [0.0, 0.3, 0.6, 0.9];
      const e = responderVarias(iniciarEscadaTeste(4, 0), [true, true, true, true, true, false, false]);
      // 0,0 ✓✓ · 0,3 ✓✓ · 0,6 ✓✗✗ -> 0,3 + 1/3 de 0,3
      expect(limiarFinoTeste(e, LOG_CS)).toBeCloseTo(0.4, 6);
    });
  });

  it("passa um nível com 2 acertos e avança logo, sem 3.º optótipo", () => {
    const e = responderVarias(iniciarEscadaTeste(12, 3), [true, true]);
    expect(e.indice).toBe(4);
    expect(e.respostas).toBe(2);
  });

  it("acerto-erro-acerto também passa", () => {
    const e = responderVarias(iniciarEscadaTeste(12, 3), [true, false, true]);
    expect(e.indice).toBe(4);
  });

  it("encontra o limiar de um observador perfeito até ao índice 7", () => {
    const e = simularTeste(12, 3, 7);
    expect(e.terminado).toBe(true);
    expect(e.limiar).toBe(7);
    expect(e.atingiuLimite).toBe(false);
  });

  it("se falha no início, desce para níveis maiores até passar", () => {
    const e = simularTeste(12, 3, 1);
    expect(e.limiar).toBe(1);
    expect(e.falhados).toEqual([3, 2]);
  });

  it("sem conseguir ler nem o maior nível, limiar null", () => {
    const e = simularTeste(12, 3, -1);
    expect(e.terminado).toBe(true);
    expect(e.limiar).toBeNull();
  });

  it("passar o nível mais pequeno do ecrã marca o limite (oferecer 1 m)", () => {
    const e = simularTeste(8, 3, 100);
    expect(e.limiar).toBe(7);
    expect(e.atingiuLimite).toBe(true);
  });

  it("depois de terminado, ignora respostas", () => {
    const e = simularTeste(8, 3, 5);
    expect(responderTeste(e, true)).toBe(e);
  });
});

describe("escada do treino", () => {
  it("2 acertos seguidos sobem a dificuldade; 1 erro desce", () => {
    let e = iniciarEscadaTreino(20, 5);
    e = responderTreino(e, true);
    expect(e.indice).toBe(5);
    e = responderTreino(e, true);
    expect(e.indice).toBe(6);
    e = responderTreino(e, false);
    expect(e.indice).toBe(5);
  });

  it("não sai dos limites da lista", () => {
    let e: EstadoEscadaTreino = iniciarEscadaTreino(3, 0);
    e = responderTreino(e, false);
    expect(e.indice).toBe(0);
    for (let i = 0; i < 10; i++) e = responderTreino(e, true);
    expect(e.indice).toBe(2);
  });

  it("o limiar converge para a zona onde o observador começa a errar", () => {
    let e = iniciarEscadaTreino(40, 5);
    for (let i = 0; i < 80; i++) e = responderTreino(e, e.indice <= 15);
    expect(e.inversoes.length).toBeGreaterThanOrEqual(6);
    expect(limiarTreino(e)).toBeGreaterThanOrEqual(14);
    expect(limiarTreino(e)).toBeLessThanOrEqual(17);
    expect(e.melhor).toBe(16);
  });

  // Caso real (2026-10-08): o resumo do treino mostrava um "limiar desta
  // sessão" que a sessão nunca mediu -- o nível de partida, ou o anel maior
  // para quem errou tudo -- e esse número ia para o progresso e o relatório.
  it("sessão terminada logo no início: não mediu limiar nenhum (null, nunca o nível de partida)", () => {
    let e = iniciarEscadaTreino(20, 8);
    for (const r of [true, true, false]) e = responderTreino(e, r);
    expect(limiarTreino(e)).toBeNull();
  });

  it("errar tudo, mesmo no nível mais fácil, não mede limiar (nunca 'leu o maior')", () => {
    let e = iniciarEscadaTreino(20, 8);
    for (let i = 0; i < 120; i++) e = responderTreino(e, false);
    expect(e.indice).toBe(0);
    expect(limiarTreino(e)).toBeNull();
  });

  it(`com ${INVERSOES_MINIMAS} inversões já há limiar`, () => {
    let e = iniciarEscadaTreino(20, 5);
    for (let i = 0; i < 200 && e.inversoes.length < INVERSOES_MINIMAS; i++) e = responderTreino(e, e.indice <= 8);
    expect(e.inversoes.length).toBe(INVERSOES_MINIMAS);
    expect(limiarTreino(e)).not.toBeNull();
  });

  it("valorNoIndice interpola entre níveis", () => {
    expect(valorNoIndice([1, 0.9, 0.8], 1.5)).toBeCloseTo(0.85, 6);
    expect(valorNoIndice([1, 0.9, 0.8], 2)).toBeCloseTo(0.8, 6);
  });
});

describe("aleatoriedade", () => {
  it("a direcção nunca repete a anterior", () => {
    let anterior: Direccao | null = null;
    for (let i = 0; i < 500; i++) {
      const d = direccaoAleatoria(anterior);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThan(8);
      expect(d).not.toBe(anterior);
      anterior = d;
    }
  });

  it("cobre as 8 direcções", () => {
    const vistas = new Set<number>();
    let anterior: Direccao | null = null;
    for (let i = 0; i < 400; i++) vistas.add((anterior = direccaoAleatoria(anterior)));
    expect(vistas.size).toBe(8);
  });

  it("escolha entre formas nunca repete a anterior", () => {
    let anterior: number | null = null;
    for (let i = 0; i < 200; i++) {
      const f = escolhaAleatoria(4, anterior);
      expect(f).not.toBe(anterior);
      anterior = f;
    }
  });
});
