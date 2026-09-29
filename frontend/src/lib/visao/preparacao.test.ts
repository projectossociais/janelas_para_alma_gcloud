import { beforeEach, describe, expect, it } from "vitest";
import { guardarEscolhas, lerEscolhas, podeUsarSessaoRapida, type EscolhasTreino } from "./preparacao";

const ESCOLHAS: EscolhasTreino = { distanciaMm: 600, usaCorreccao: true, olho: "esquerdo" };
const CALIBRADO = { pxPorMm: 4.2, calibrado: true };

describe("escolhas guardadas por aparelho", () => {
  beforeEach(() => window.localStorage.clear());

  it("guarda e lê as escolhas de cada treino em separado", () => {
    guardarEscolhas("ambliopia", ESCOLHAS);
    expect(lerEscolhas("ambliopia")).toEqual(ESCOLHAS);
    expect(lerEscolhas("convergence")).toBeNull();
  });

  it("ignora dados corrompidos ou incompletos -- cai no fluxo completo", () => {
    window.localStorage.setItem("jpa.visao.escolhas.ambliopia", "{nao-e-json");
    expect(lerEscolhas("ambliopia")).toBeNull();
    window.localStorage.setItem("jpa.visao.escolhas.ambliopia", JSON.stringify({ distanciaMm: -1, usaCorreccao: true, olho: null }));
    expect(lerEscolhas("ambliopia")).toBeNull();
    window.localStorage.setItem("jpa.visao.escolhas.ambliopia", JSON.stringify({ distanciaMm: 600, olho: "meio" }));
    expect(lerEscolhas("ambliopia")).toBeNull();
  });
});

describe("podeUsarSessaoRapida", () => {
  it("oferece a sessão rápida quando nada mudou", () => {
    expect(podeUsarSessaoRapida({ escolhas: ESCOLHAS, calibracao: CALIBRADO, monocular: true, olhoActual: "esquerdo" })).toBe(true);
  });

  it("nunca na primeira vez (sem escolhas guardadas)", () => {
    expect(podeUsarSessaoRapida({ escolhas: null, calibracao: CALIBRADO, monocular: true, olhoActual: "esquerdo" })).toBe(false);
  });

  it("nunca sem ter passado pelo passo do cartão neste aparelho", () => {
    expect(podeUsarSessaoRapida({ escolhas: ESCOLHAS, calibracao: null, monocular: true, olhoActual: "esquerdo" })).toBe(false);
  });

  it("nunca se o olho mais fraco mudou desde a última vez -- o tapa-olho tem de mudar de lado", () => {
    expect(podeUsarSessaoRapida({ escolhas: ESCOLHAS, calibracao: CALIBRADO, monocular: true, olhoActual: "direito" })).toBe(false);
    expect(podeUsarSessaoRapida({ escolhas: ESCOLHAS, calibracao: CALIBRADO, monocular: true, olhoActual: null })).toBe(false);
  });

  it("nos treinos com os dois olhos, o olho não conta", () => {
    const ambos = { ...ESCOLHAS, olho: null };
    expect(podeUsarSessaoRapida({ escolhas: ambos, calibracao: CALIBRADO, monocular: false, olhoActual: null })).toBe(true);
  });

  it("aceita um ecrã sem cartão (o aviso de pouca fiabilidade aparece no ecrã rápido)", () => {
    expect(
      podeUsarSessaoRapida({ escolhas: ESCOLHAS, calibracao: { pxPorMm: 3.78, calibrado: false }, monocular: true, olhoActual: "esquerdo" }),
    ).toBe(true);
  });
});
