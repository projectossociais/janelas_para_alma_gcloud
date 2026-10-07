import { describe, expect, it } from "vitest";
import {
  DIAMETRO_IRIS_MM,
  FATOR_HIRSCHBERG_DELTA_POR_MM as FH,
  KAPPA_POPULACIONAL_MM as KAPPA,
  desvioBinocular,
  direccaoHorizontal,
} from "./binocular";
import { geradorAleatorio } from "./geometria";
import type { MedicaoOlho } from "./olho";
import { analisarFotografia } from "./sessao";
import { gerarCena } from "./testes/cenaSintetica";

/**
 * Convenção dos casos: numa fotografia normal, o olho direito (OD) aparece à
 * esquerda da imagem (x = 100) e o esquerdo (OS) à direita (x = 400). O nariz
 * fica entre os dois: para o OD é +x, para o OS é −x.
 */
const RAIO = 48;
const MM_POR_PX = DIAMETRO_IRIS_MM / (2 * RAIO);

function olho(cx: number, sentidoNasal: 1 | -1, nasalMm: number, superiorMm = 0, raio = RAIO): MedicaoOlho {
  return {
    iris: { centro: { x: cx, y: 200 }, raio },
    reflexo: { x: cx + (sentidoNasal * nasalMm) / MM_POR_PX, y: 200 - superiorMm / MM_POR_PX },
    erroLimboPx: 0.2,
    contrasteReflexo: 150,
  };
}
const od = (nasalMm: number, superiorMm = 0) => olho(100, 1, nasalMm, superiorMm);
const os = (nasalMm: number, superiorMm = 0) => olho(400, -1, nasalMm, superiorMm);

const medir = (a: MedicaoOlho, b: MedicaoOlho, espelhada = false) => {
  const r = desvioBinocular(a, b, { espelhada });
  if (r.ok === false) throw new Error(r.motivo);
  return r.valor;
};

describe("desvio binocular (Hirschberg)", () => {
  it("olhos alinhados: o kappa igual nos dois olhos anula-se", () => {
    const d = medir(od(KAPPA), os(KAPPA));
    expect(d.horizontalDelta).toBeCloseTo(0, 6);
    expect(d.verticalDelta).toBeCloseTo(0, 6);
  });

  it("exotropia de 15 Δ do olho esquerdo (o direito fixa)", () => {
    const d = medir(od(KAPPA), os(KAPPA + 15 / FH));
    expect(Math.abs(d.horizontalDelta)).toBeCloseTo(15, 6);
    expect(direccaoHorizontal(d)).toBe("exo");
  });

  it("esotropia de 20 Δ do olho direito (o esquerdo fixa)", () => {
    const d = medir(od(KAPPA - 20 / FH), os(KAPPA));
    expect(Math.abs(d.horizontalDelta)).toBeCloseTo(20, 6);
    expect(direccaoHorizontal(d)).toBe("eso");
  });

  it("desvio vertical de 6 Δ", () => {
    const d = medir(od(KAPPA, 0), os(KAPPA, 6 / FH));
    expect(Math.abs(d.verticalDelta)).toBeCloseTo(6, 6);
  });

  it("abaixo de 10 Δ não se diz a direcção (não é fiável)", () => {
    expect(direccaoHorizontal(medir(od(KAPPA), os(KAPPA + 8 / FH)))).toBeNull();
  });

  it("a ordem de entrada dos olhos não importa", () => {
    expect(medir(os(KAPPA + 12 / FH), od(KAPPA))).toEqual(medir(od(KAPPA), os(KAPPA + 12 / FH)));
  });

  it("numa imagem espelhada, o tamanho do desvio é o mesmo", () => {
    const normal = medir(od(KAPPA), os(KAPPA + 12 / FH));
    const espelhada = medir(od(KAPPA), os(KAPPA + 12 / FH), true);
    expect(Math.abs(espelhada.horizontalDelta)).toBeCloseTo(Math.abs(normal.horizontalDelta), 6);
  });

  it("íris de tamanhos muito diferentes (cabeça rodada, erro de medida) recusam a fotografia", () => {
    const r = desvioBinocular(olho(100, 1, KAPPA, 0, 48), olho(400, -1, KAPPA, 0, 40));
    expect(r).toEqual({ ok: false, motivo: "iris-inconsistentes" });
  });
});

describe("limitações conhecidas do método (documentadas, não escondidas)", () => {
  it("olhar 3 Δ ao lado da luz, sem estrabismo, aparece como 6 Δ (2θ)", () => {
    // Os dois olhos rodam juntos θ: o reflexo de um vai θ/FH para o nariz, o do outro θ/FH para fora.
    const theta = 3 / FH;
    const d = medir(od(KAPPA - theta), os(KAPPA + theta));
    expect(Math.abs(d.horizontalDelta)).toBeCloseTo(6, 6);
  });

  it("kappa diferente nos dois olhos (0,2 mm) aparece como ~4 Δ de desvio", () => {
    const d = medir(od(KAPPA), os(KAPPA + 0.2));
    expect(Math.abs(d.horizontalDelta)).toBeCloseTo(0.2 * FH, 6);
  });
});

describe("de ponta a ponta, com imagens sintéticas", () => {
  it("em 30 pares de olhos com desvios conhecidos (0 a 30 Δ), o erro fica < 1,5 Δ em 95% dos casos", () => {
    const aleatorio = geradorAleatorio(77);
    const entre = (a: number, b: number) => a + (b - a) * aleatorio();
    const erros: number[] = [];
    let falhas = 0;
    for (let i = 0; i < 30; i++) {
      const raio = entre(42, 55);
      const mmPorPx = DIAMETRO_IRIS_MM / (2 * raio);
      const desvio = [0, 4, 8, 12, 20, 30][i % 6]! * (i % 2 ? 1 : -1); // exo e eso
      const kappa = entre(0.3, 0.7);
      const cOD = { x: 150 + entre(-0.5, 0.5), y: 120 + entre(-0.5, 0.5) };
      const cOS = { x: 150 + 6.2 * raio + entre(-0.5, 0.5), y: 120 + entre(-2, 2) };
      // OD fixa (descentração = kappa); OS desviado (kappa + desvio/FH), nasal = −x no OS.
      const reflexoOD = { x: cOD.x + kappa / mmPorPx, y: cOD.y };
      const reflexoOS = { x: cOS.x - (kappa + desvio / FH) / mmPorPx, y: cOS.y };
      const tom = entre(25, 80);
      const img = gerarCena({
        largura: Math.ceil(cOS.x + 3 * raio),
        altura: 240,
        olhos: [
          { centroIris: cOD, raioIris: raio, reflexo: reflexoOD, tomIris: tom, palpebraSuperior: entre(0, 0.3) },
          { centroIris: cOS, raioIris: raio, reflexo: reflexoOS, tomIris: tom, palpebraSuperior: entre(0, 0.3) },
        ],
        tomPele: entre(60, 150),
        desfoque: entre(0.8, 1.4),
        ruido: entre(1, 4),
        semente: 100 + i,
      });
      const aprox = (c: { x: number; y: number }) => ({
        centro: { x: c.x + entre(-0.12, 0.12) * raio, y: c.y + entre(-0.12, 0.12) * raio },
        raio: raio * entre(0.88, 1.12),
      });
      const r = analisarFotografia(img, [aprox(cOD), aprox(cOS)]);
      if (r.ok === false) {
        falhas++;
        continue;
      }
      // Desvio esperado com o sinal da convenção: nasal(OD) − nasal(OS) = −desvio.
      erros.push(Math.abs(r.valor.horizontalDelta - -desvio));
    }
    erros.sort((a, b) => a - b);
    expect(falhas).toBeLessThanOrEqual(2);
    expect(erros[Math.floor(0.95 * (erros.length - 1))]!).toBeLessThan(1.5);
  }, 60_000);
});
