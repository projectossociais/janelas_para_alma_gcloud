import { describe, expect, it, vi } from "vitest";
import jsPDF from "jspdf";
import { ESTILO_RELATORIO, RelatorioPdf } from "./pdfRelatorio";

// Estilo único de relatório (pedido do dono do projecto, 2026-09-29): preto
// sobre branco, sem cores decorativas nem caixas. Este teste impede que um
// relatório volte a ganhar cor sem ninguém dar por isso.

const gerar = (linhasTabela = 3) => {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const spies = {
    fill: vi.spyOn(doc, "setFillColor"),
    rounded: vi.spyOn(doc, "roundedRect"),
    rect: vi.spyOn(doc, "rect"),
    cor: vi.spyOn(doc, "setTextColor"),
    fonte: vi.spyOn(doc, "setFont"),
    tamanho: vi.spyOn(doc, "setFontSize"),
  };
  const r = new RelatorioPdf(doc);
  r.cabecalho({ organizacao: "Janelas Para a Alma", titulo: "Relatório", subtitulo: "Emitido em 29/09/2026" });
  r.paragrafo("Introdução.", { cinzento: true });
  r.seccao("Resultado");
  r.campos([["Campo", "Valor"]]);
  r.lista(["um", "dois"]);
  r.seccao("Tabela");
  r.tabela(
    [
      { titulo: "A", largura: 0.5 },
      { titulo: "B", largura: 0.5 },
    ],
    Array.from({ length: linhasTabela }, (_, i) => [`linha ${i}`, "valor"]),
  );
  r.rodape("Rodapé", (i, n) => `Página ${i} de ${n}`);
  return { doc, spies };
};

describe("RelatorioPdf (estilo único dos relatórios)", () => {
  it("sem preenchimentos, caixas nem cantos arredondados", () => {
    const { spies } = gerar();
    expect(spies.fill).not.toHaveBeenCalled();
    expect(spies.rounded).not.toHaveBeenCalled();
    expect(spies.rect).not.toHaveBeenCalled();
  });

  it("texto só a preto ou no cinzento das notas", () => {
    const { spies } = gerar();
    const permitidas = [ESTILO_RELATORIO.tinta, ESTILO_RELATORIO.cinzento].map((c) => c.join(","));
    for (const chamada of spies.cor.mock.calls) expect(permitidas).toContain(chamada.slice(0, 3).join(","));
  });

  it("uma só família de letra, em no máximo quatro tamanhos", () => {
    const { spies } = gerar();
    expect(new Set(spies.fonte.mock.calls.map((c) => c[0]))).toEqual(new Set(["helvetica"]));
    expect(new Set(spies.tamanho.mock.calls.map((c) => c[0])).size).toBeLessThanOrEqual(4);
  });

  it("tabelas longas passam para a página seguinte, com rodapé e paginação em todas", () => {
    const { doc } = gerar(120);
    const total = doc.getNumberOfPages();
    expect(total).toBeGreaterThan(1);
    // O rodapé escreve "Página i de N" em todas as páginas.
    const texto = doc.output();
    for (let i = 1; i <= total; i++) expect(texto).toContain(`Página ${i} de ${total}`);
  });
});
