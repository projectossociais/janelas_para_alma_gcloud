/**
 * Estilo único dos relatórios em PDF (pedido do dono do projecto, 2026-09-29):
 * layout e simplicidade de relatório -- preto sobre branco, uma só família de
 * letra (Helvetica) em três tamanhos, secções numeradas, tabelas com linhas
 * finas, cabeçalho e rodapé discretos em todas as páginas. Nada de cores de
 * marca, caixas arredondadas, "crachás" nem texto centrado.
 *
 * Um relatório novo usa esta classe em vez de desenhar com jsPDF à mão, para
 * todos ficarem iguais.
 */
import type jsPDF from "jspdf";

/** Todas as medidas em pontos (A4 = 595 x 842). */
export const ESTILO_RELATORIO = {
  margem: 56,
  corpo: 10,
  seccao: 11.5,
  titulo: 15,
  pequeno: 8,
  entrelinha: 1.35,
  /** Preto para o texto; um só cinzento para linhas e notas. */
  tinta: [0, 0, 0] as [number, number, number],
  cinzento: [110, 110, 110] as [number, number, number],
  linha: [170, 170, 170] as [number, number, number],
  alturaRodape: 36,
} as const;

export interface CabecalhoRelatorio {
  /** Linha pequena por cima do título (ex.: "Janelas Para a Alma"). */
  organizacao: string;
  titulo: string;
  /** Ex.: "Emitido em 29/09/2026, 10:30". */
  subtitulo: string;
}

export interface Coluna {
  titulo: string;
  /** Fracção da largura útil (a soma deve dar 1). */
  largura: number;
}

/** Largura da coluna dos nomes em `campos` e o espaço mínimo até ao valor (pt). */
export const COLUNA_CAMPO = 150;
const ESPACO_CAMPO = 12;

export class RelatorioPdf {
  private readonly doc: jsPDF;
  private y: number;
  private seccoes = 0;
  private readonly largura: number;
  private readonly altura: number;
  private readonly m = ESTILO_RELATORIO.margem;

  constructor(doc: jsPDF) {
    this.doc = doc;
    this.largura = doc.internal.pageSize.getWidth();
    this.altura = doc.internal.pageSize.getHeight();
    this.y = this.m;
  }

  private get util() {
    return this.largura - this.m * 2;
  }

  private alturaLinha(tamanho: number) {
    return tamanho * ESTILO_RELATORIO.entrelinha;
  }

  private fonte(tamanho: number, negrito = false, cor = ESTILO_RELATORIO.tinta) {
    this.doc.setFont("helvetica", negrito ? "bold" : "normal");
    this.doc.setFontSize(tamanho);
    this.doc.setTextColor(...cor);
  }

  private regua(y: number) {
    this.doc.setDrawColor(...ESTILO_RELATORIO.linha);
    this.doc.setLineWidth(0.5);
    this.doc.line(this.m, y, this.largura - this.m, y);
  }

  /** Muda de página se não couberem `altura` pontos antes do rodapé. */
  private garantir(altura: number) {
    if (this.y + altura > this.altura - this.m - ESTILO_RELATORIO.alturaRodape) {
      this.doc.addPage();
      this.y = this.m;
    }
  }

  cabecalho(c: CabecalhoRelatorio, logo?: { dataUrl: string; largura: number; altura: number } | null) {
    const alturaLogo = 26;
    if (logo) {
      const w = (logo.largura / logo.altura) * alturaLogo;
      this.doc.addImage(logo.dataUrl, "PNG", this.largura - this.m - w, this.y - 4, w, alturaLogo);
    }
    this.fonte(ESTILO_RELATORIO.pequeno, false, ESTILO_RELATORIO.cinzento);
    this.doc.text(c.organizacao.toUpperCase(), this.m, this.y + 4);
    this.y += 22;
    this.fonte(ESTILO_RELATORIO.titulo, true);
    const titulo = this.doc.splitTextToSize(c.titulo, this.util - 80);
    this.doc.text(titulo, this.m, this.y);
    this.y += titulo.length * this.alturaLinha(ESTILO_RELATORIO.titulo);
    this.fonte(ESTILO_RELATORIO.corpo, false, ESTILO_RELATORIO.cinzento);
    this.doc.text(c.subtitulo, this.m, this.y);
    this.y += 10;
    this.regua(this.y);
    this.y += 22;
  }

  /** Título de secção numerado ("1. Resultado"). */
  seccao(titulo: string) {
    this.garantir(60);
    this.seccoes += 1;
    this.y += 6;
    this.fonte(ESTILO_RELATORIO.seccao, true);
    this.doc.text(`${this.seccoes}. ${titulo}`, this.m, this.y);
    this.y += this.alturaLinha(ESTILO_RELATORIO.seccao) + 2;
  }

  paragrafo(texto: string, opcoes: { cinzento?: boolean } = {}) {
    this.fonte(ESTILO_RELATORIO.corpo, false, opcoes.cinzento ? ESTILO_RELATORIO.cinzento : ESTILO_RELATORIO.tinta);
    const linhas: string[] = this.doc.splitTextToSize(texto, this.util);
    const h = this.alturaLinha(ESTILO_RELATORIO.corpo);
    for (const linha of linhas) {
      this.garantir(h);
      this.doc.text(linha, this.m, this.y);
      this.y += h;
    }
    this.y += 6;
  }

  lista(itens: readonly string[]) {
    this.fonte(ESTILO_RELATORIO.corpo);
    const h = this.alturaLinha(ESTILO_RELATORIO.corpo);
    for (const item of itens) {
      const linhas: string[] = this.doc.splitTextToSize(item, this.util - 14);
      this.garantir(h * linhas.length);
      this.doc.text("–", this.m + 2, this.y);
      this.doc.text(linhas, this.m + 14, this.y, { lineHeightFactor: ESTILO_RELATORIO.entrelinha });
      this.y += h * linhas.length + 2;
    }
    this.y += 6;
  }

  /** Pares "Campo: valor" alinhados em duas colunas. */
  campos(pares: readonly [string, string][]) {
    const h = this.alturaLinha(ESTILO_RELATORIO.corpo) + 2;
    for (const [campo, valor] of pares) {
      // O nome também muda de linha dentro da sua coluna: um nome comprido
      // escrevia-se por cima do valor (caso real, relatório de 2026-10-06).
      this.fonte(ESTILO_RELATORIO.corpo, true);
      const nome: string[] = this.doc.splitTextToSize(campo, COLUNA_CAMPO - ESPACO_CAMPO);
      this.fonte(ESTILO_RELATORIO.corpo);
      const linhas: string[] = this.doc.splitTextToSize(valor, this.util - COLUNA_CAMPO);
      const n = Math.max(nome.length, linhas.length);
      this.garantir(h * n);
      this.fonte(ESTILO_RELATORIO.corpo, true);
      this.doc.text(nome, this.m, this.y, { lineHeightFactor: ESTILO_RELATORIO.entrelinha });
      this.fonte(ESTILO_RELATORIO.corpo);
      this.doc.text(linhas, this.m + COLUNA_CAMPO, this.y, { lineHeightFactor: ESTILO_RELATORIO.entrelinha });
      this.y += h * n;
    }
    this.y += 8;
  }

  tabela(colunas: readonly Coluna[], linhas: readonly (readonly string[])[]) {
    const h = this.alturaLinha(ESTILO_RELATORIO.corpo);
    const xs = colunas.reduce<number[]>((acc, _c, i) => {
      acc.push(i === 0 ? this.m : acc[i - 1] + colunas[i - 1].largura * this.util);
      return acc;
    }, []);
    const cabecalho = () => {
      this.fonte(ESTILO_RELATORIO.corpo, true);
      colunas.forEach((c, i) => this.doc.text(c.titulo, xs[i], this.y));
      this.y += 5;
      this.regua(this.y);
      this.y += h;
    };
    this.garantir(h * 3);
    cabecalho();
    for (const linha of linhas) {
      this.fonte(ESTILO_RELATORIO.corpo);
      const partidas = linha.map((txt, i) => this.doc.splitTextToSize(txt, colunas[i].largura * this.util - 8) as string[]);
      const n = Math.max(...partidas.map((p) => p.length));
      if (this.y + h * n > this.altura - this.m - ESTILO_RELATORIO.alturaRodape) {
        this.doc.addPage();
        this.y = this.m;
        cabecalho();
        this.fonte(ESTILO_RELATORIO.corpo);
      }
      partidas.forEach((p, i) => this.doc.text(p, xs[i], this.y, { lineHeightFactor: ESTILO_RELATORIO.entrelinha }));
      this.y += h * (n - 1) + 4;
      this.regua(this.y);
      this.y += h;
    }
    this.y += 4;
  }

  /** Rodapé em todas as páginas: régua fina, texto à esquerda, "Página x de y" à direita. */
  rodape(texto: string, pagina: (i: number, total: number) => string) {
    const total = this.doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      this.doc.setPage(i);
      const y = this.altura - this.m + 8;
      this.regua(y - 12);
      this.fonte(ESTILO_RELATORIO.pequeno, false, ESTILO_RELATORIO.cinzento);
      this.doc.text(texto, this.m, y);
      this.doc.text(pagina(i, total), this.largura - this.m, y, { align: "right" });
    }
  }
}
