import { describe, expect, it } from "vitest";
import { NARIZ_MM, TOPO_PX, classeDoPpc, inicioDaMissanga, posicaoDaMissanga, resumirFio, roturaAlem, yDoCm, type RondaFio } from "./fioMissangas";

const ronda = (rotura: number, recuperacao: number | null = rotura + 2, alem = false): RondaFio => ({ rotura, recuperacao, alem });

describe("o ecrã como régua", () => {
  it("a missanga parte do ponto mais alto do ecrã, a meio centímetro", () => {
    // 6 px/mm: 768 px de altura, menos o topo, são 12,3 cm.
    expect(inicioDaMissanga(768, 6)).toBe(12);
    expect(inicioDaMissanga(TOPO_PX + 6 * 87, 6)).toBe(8.5);
  });

  it("num tablet não parte de mais longe do que 20 cm", () => {
    expect(inicioDaMissanga(3000, 6)).toBe(20);
  });

  it("1 cm a partir do fundo são 10 mm de píxeis", () => {
    expect(yDoCm(1, 768, 6)).toBe(708);
    expect(yDoCm(0, 768, 6)).toBe(768);
  });
});

describe("a missanga a andar", () => {
  it("desce 1 cm por segundo e pára no nariz", () => {
    expect(posicaoDaMissanga(12, 3, "aproximar", 12)).toBe(9);
    expect(posicaoDaMissanga(12, 30, "aproximar", 12)).toBe(NARIZ_MM / 10);
  });

  it("sobe a partir da rotura e pára no início", () => {
    expect(posicaoDaMissanga(5, 2, "afastar", 12)).toBe(7);
    expect(posicaoDaMissanga(5, 20, "afastar", 12)).toBe(12);
  });

  it("tocar logo à partida é mais longe do que o ecrã", () => {
    expect(roturaAlem(11.5, 12)).toBe(true);
    expect(roturaAlem(11, 12)).toBe(false);
  });
});

describe("resumo das três rondas", () => {
  it("PPC e recuperação: médias, com a classe", () => {
    expect(resumirFio([ronda(5, 7), ronda(6, 8), ronda(5.5, 7.5)])).toMatchObject({ ppcCm: 5.5, recuperacaoCm: 7.5, classe: "esperado", cansaco: false });
    expect(resumirFio([ronda(8), ronda(9), ronda(8.5)]).classe).toBe("limite");
    expect(resumirFio([ronda(11), ronda(12), ronda(11)]).classe).toBe("alto");
  });

  it("uma rotura para lá do ecrã: sem média, conta como acima", () => {
    expect(resumirFio([ronda(7), ronda(12, null, true), ronda(7)])).toMatchObject({ ppcCm: null, alemDoEcra: true, classe: "alto" });
  });

  it("uma recuperação fora do ecrã: sem média de recuperação", () => {
    expect(resumirFio([ronda(7, 9), ronda(7, null), ronda(7, 9)]).recuperacaoCm).toBeNull();
  });

  it("chegou sempre ao nariz: PPC 0, esperado", () => {
    expect(resumirFio([ronda(0, 0), ronda(0, 0), ronda(0, 0)])).toMatchObject({ ppcCm: 0, chegouAoNariz: true, classe: "esperado" });
  });

  it("a última rotura 3 cm mais longe do que a primeira é cansaço", () => {
    expect(resumirFio([ronda(5), ronda(6), ronda(8)]).cansaco).toBe(true);
    expect(resumirFio([ronda(5), ronda(6), ronda(7.5)]).cansaco).toBe(false);
  });

  it("limites das classes", () => {
    expect(classeDoPpc(6)).toBe("esperado");
    expect(classeDoPpc(10)).toBe("limite");
    expect(classeDoPpc(10.5)).toBe("alto");
    expect(classeDoPpc(null)).toBe("alto");
  });
});
