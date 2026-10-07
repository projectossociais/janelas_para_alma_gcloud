import { describe, expect, it } from "vitest";
import { deltaDeGraus } from "./calibracao";
import { lerCsvBancada, relatorioV1, relatorioV1EmMarkdown } from "./relatorioV1";

const CABECALHO =
  "id,pessoa,alvo_graus,origem,posicoes,resolucao,motivo,horizontal_delta,vertical_delta,nasal_od_mm,nasal_os_mm,superior_od_mm,superior_os_mm,mm_por_px";

/** Uma pessoa sem estrabismo com factor `fator`: a fixar α, OD perde α/fator de descentração e OS ganha. */
function linhasPessoa(pessoa: string, fator: number, kappa = 0.5, origem = "A: fotografia", desvioEmFrente = 0) {
  const linhas: string[] = [];
  let id = 1;
  for (const g of [-15, -10, -5, 0, 0, 0, 5, 10, 15]) {
    const d = deltaDeGraus(g) / fator;
    const od = kappa - d;
    const os = kappa + d - (g === 0 ? desvioEmFrente / 21 : 0);
    const h = (od - os) * 21;
    linhas.push(`${id++},${pessoa},${g},${origem},detector,4000×3000,,${h},0.2,${od},${os},0,0,0.03`);
  }
  return linhas;
}

describe("relatório da fase V1", () => {
  it("lê o CSV da bancada pelo nome das colunas", () => {
    const r = lerCsvBancada([CABECALHO, "1,A,5,B: câmara nativa,toques,4000×3000,,1.5,0.3,0.4,0.6,0,0,0.03"].join("\n"));
    expect(r).toEqual([
      {
        pessoa: "A",
        alvoGraus: 5,
        caminho: "B",
        posicoes: "toques",
        motivo: null,
        horizontalDelta: 1.5,
        verticalDelta: 0.3,
        nasalOdMm: 0.4,
        nasalOsMm: 0.6,
      },
    ]);
  });

  it("uma pessoa com factor 21 Δ/mm e alinhada passa; uma com factor 28 não", () => {
    const csv = [CABECALHO, ...linhasPessoa("Ana", 21), ...linhasPessoa("Bruno", 28)].join("\n");
    const r = relatorioV1(lerCsvBancada(csv));
    const ana = r.pessoas.find((p) => p.pessoa === "Ana")!;
    const bruno = r.pessoas.find((p) => p.pessoa === "Bruno")!;
    expect(ana.olhoDireito.calibracao?.fatorDeltaPorMm).toBeCloseTo(21, 6);
    expect(ana.olhoEsquerdo.calibracao?.descentracaoNaCameraMm).toBeCloseTo(0.5, 6);
    expect(ana.passaV1).toBe(true);
    expect(bruno.olhoDireito.passa).toBe(false);
    expect(bruno.passaV1).toBe(false);
    expect(r.pessoasQuePassam).toBe(1);
    expect(r.fatorMedio).toBeCloseTo((21 * 2 + 28 * 2) / 4, 6);
  });

  it("desvio a olhar em frente de 4 Δ não passa (pessoa sem estrabismo deve medir < 3 Δ)", () => {
    const r = relatorioV1(lerCsvBancada([CABECALHO, ...linhasPessoa("Carla", 21, 0.5, "A: fotografia", 4)].join("\n")));
    expect(Math.abs(r.pessoas[0]!.horizontalEmFrenteDelta!)).toBeCloseTo(4, 6);
    expect(r.pessoas[0]!.emFrentePassa).toBe(false);
  });

  it("conta sucesso e motivos de falha por caminho e por origem das posições", () => {
    const csv = [
      CABECALHO,
      ...linhasPessoa("Ana", 21, 0.5, "A: fotografia"),
      "90,Ana,0,B: câmara nativa,toques,4000×3000,sem-reflexo,,,,,,,",
      "91,Ana,0,B: câmara nativa,toques,4000×3000,sem-reflexo,,,,,,,",
      "92,Ana,0,B: câmara nativa,toques,4000×3000,,0.5,0,0.5,0.476,0,0,0.03",
    ].join("\n");
    const r = relatorioV1(lerCsvBancada(csv));
    expect(r.porCaminho).toEqual([
      { grupo: "A", fotografias: 9, medidas: 9, motivos: {} },
      { grupo: "B", fotografias: 3, medidas: 1, motivos: { "sem-reflexo": 2 } },
    ]);
    expect(r.porPosicoes.map((t) => t.grupo)).toEqual(["detector", "toques"]);
  });

  it("o relatório em texto diz quantas pessoas passam e lista cada uma", () => {
    const md = relatorioV1EmMarkdown(relatorioV1(lerCsvBancada([CABECALHO, ...linhasPessoa("Ana", 21)].join("\n"))));
    expect(md).toContain("**1 de 1 pessoas passam.**");
    expect(md).toMatch(/\| Ana \| 9\/9 \| 21\.0 \(1\.000\)/);
  });
});
