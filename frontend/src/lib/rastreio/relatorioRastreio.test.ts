import { describe, expect, it } from "vitest";
import type { ScreeningResponse } from "@/services/api/screeningApi";
import { escreverRelatorioRastreio, type EscritorRelatorio } from "./relatorioRastreio";
import type { ResultadoGuardado } from "./rastreio";

/** Regista o que se escreveu, sem gerar PDF. A tradução devolve a chave. */
function gravar(resultado: ResultadoGuardado) {
  const linhas: string[] = [];
  const escritor: EscritorRelatorio = {
    seccao: (t) => void linhas.push(`# ${t}`),
    paragrafo: (t) => void linhas.push(t),
    lista: (itens) => void linhas.push(...itens),
    campos: (pares) => void linhas.push(...pares.map(([c, v]) => `${c}: ${v}`)),
    tabela: (_, ls) => void linhas.push(...ls.map((l) => l.join(" | "))),
  };
  const t = (chave: string) => chave.replace("ResultadoRastreio.", "");
  escreverRelatorioRastreio(escritor, resultado, t, "30/09/2026 10:00");
  return linhas;
}

const ANALISE: ScreeningResponse = {
  estado: "concluido",
  requer_avaliacao_humana: true,
  incomitante: true,
  variacao_desalinhamento: 4.25,
  recomendacao: "Texto livre desconhecido.",
  posicoes: [
    { posicao: "CENTRO", estado: "ok", rosto_detetado: true, qualidade_captura: { pontuacao: 0.874, fiavel: true } },
    { posicao: "ESQUERDA", estado: "ok", rosto_detetado: false },
  ],
};

describe("escreverRelatorioRastreio", () => {
  it("tem o resultado, as medições reais e a qualidade de cada fotografia", () => {
    const linhas = gravar({ conclusao: "avaliacao", data: new Date(), analise: ANALISE });
    expect(linhas).toContain("pdfCampoResultado: rotuloAvaliacao");
    expect(linhas).toContain("pdfVariacao: 4.3");
    expect(linhas).toContain("pdfIncomitante: sim");
    expect(linhas).toContain("posicaoCentro | sim | 87/100 | sim");
    expect(linhas).toContain("posicaoEsquerda | nao | semDado | semDado");
    expect(linhas).toContain("pdfProximoAvaliacao");
    expect(linhas).toContain("pdfAvisoTexto");
  });

  it("nunca tem clínicas, preços, 'confiança' nem as categorias que o analisador não calcula", () => {
    const texto = gravar({ conclusao: "avaliacao", data: new Date(), analise: ANALISE }).join("\n");
    expect(texto).not.toMatch(/clinica|preco|Kz|confian|esotropia|exotropia|hipertropia|hipotropia/i);
  });

  it("sem dados da análise, fica só o resultado, o próximo passo e o aviso", () => {
    const linhas = gravar({ conclusao: "normal", data: new Date(), analise: null });
    expect(linhas.filter((l) => l.startsWith("#"))).toEqual([
      "# pdfSecResultado",
      "# proximoPasso",
      "# pdfSecAviso",
    ]);
  });
});

describe("escreverRelatorioRastreio com o jsPDF real", () => {
  it("gera um PDF com o resultado e a tabela das posições", async () => {
    const { default: jsPDF } = await import("jspdf");
    const { RelatorioPdf } = await import("@/lib/relatorio/pdfRelatorio");
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const escritos: string[] = [];
    const texto = doc.text.bind(doc);
    doc.text = ((t: string | string[], ...resto: unknown[]) => {
      escritos.push(...[t].flat());
      return (texto as (...a: unknown[]) => unknown)(t, ...resto);
    }) as typeof doc.text;
    const r = new RelatorioPdf(doc);
    escreverRelatorioRastreio(r, { conclusao: "avaliacao", data: new Date(), analise: ANALISE }, (k) => k.replace("ResultadoRastreio.", ""), "30/09/2026");
    r.rodape("Rodapé", (i, n) => `${i}/${n}`);
    expect(escritos).toEqual(expect.arrayContaining(["rotuloAvaliacao", "posicaoCentro", "87/100", "posicaoEsquerda"]));
    expect(doc.output("arraybuffer").byteLength).toBeGreaterThan(1000);
  });
});
