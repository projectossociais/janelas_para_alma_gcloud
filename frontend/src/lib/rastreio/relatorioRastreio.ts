import type { RelatorioPdf } from "@/lib/relatorio/pdfRelatorio";
import { textoDoScannerNoIdioma } from "@/services/api/screeningApi";
import { desalinhamentoEmFrente, incomitancia, variacaoDesalinhamento } from "./rastreio";
import type { Conclusao, ResultadoGuardado } from "./rastreio";

/**
 * O corpo do relatório do rastreio, para levar ao médico. Só o que a análise
 * mediu de facto: o resultado, as medições por posição e a qualidade de cada
 * fotografia. Sem categorias que o analisador não calcula, sem clínicas nem
 * preços (não são dados clínicos e mudam), sem "confiança" inventada.
 *
 * Recebe só o que usa do `RelatorioPdf` e a função de tradução, para se poder
 * testar sem gerar um PDF.
 */
export type EscritorRelatorio = Pick<RelatorioPdf, "seccao" | "paragrafo" | "lista" | "campos" | "tabela">;
type Traduzir = (chave: string, opcoes?: Record<string, unknown>) => string;

const ROTULO: Record<Conclusao, string> = {
  avaliacao: "ResultadoRastreio.rotuloAvaliacao",
  normal: "ResultadoRastreio.rotuloNormal",
  inconclusivo: "ResultadoRastreio.rotuloInconclusivo",
};

const PROXIMO: Record<Conclusao, string> = {
  avaliacao: "ResultadoRastreio.pdfProximoAvaliacao",
  normal: "ResultadoRastreio.pdfProximoNormal",
  inconclusivo: "ResultadoRastreio.pdfProximoInconclusivo",
};

const POSICOES: Record<string, string> = {
  CENTRO: "ResultadoRastreio.posicaoCentro",
  DIREITA: "ResultadoRastreio.posicaoDireita",
  ESQUERDA: "ResultadoRastreio.posicaoEsquerda",
};

export const rotuloConclusao = (c: Conclusao, t: Traduzir) => t(ROTULO[c]);

export function escreverRelatorioRastreio(
  r: EscritorRelatorio,
  resultado: ResultadoGuardado,
  t: Traduzir,
  dataFormatada: string,
  /** Idioma da página: decide a vírgula ou o ponto decimal ("-0,09" em pt). */
  idioma = "pt-AO",
): void {
  const { conclusao, analise } = resultado;
  const simNao = (v: boolean | null | undefined) =>
    v === undefined || v === null ? t("ResultadoRastreio.semDado") : v ? t("ResultadoRastreio.sim") : t("ResultadoRastreio.nao");

  r.seccao(t("ResultadoRastreio.pdfSecResultado"));
  r.campos([
    [t("ResultadoRastreio.pdfCampoResultado"), rotuloConclusao(conclusao, t)],
    [t("ResultadoRastreio.pdfCampoData"), dataFormatada],
  ]);

  if (analise) {
    r.seccao(t("ResultadoRastreio.pdfSecMedicoes"));
    // Fracções da largura do olho: duas casas (0,05 é 5% da largura).
    const formato = new Intl.NumberFormat(idioma, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const numero = (v: number | null) => (v === null ? t("ResultadoRastreio.semDado") : formato.format(v));
    r.campos([
      [t("ResultadoRastreio.pdfEmFrente"), numero(desalinhamentoEmFrente(analise))],
      [t("ResultadoRastreio.pdfVariacao"), numero(variacaoDesalinhamento(analise))],
      [t("ResultadoRastreio.pdfIncomitante"), simNao(incomitancia(analise))],
    ]);
    r.paragrafo(t("ResultadoRastreio.pdfUnidade"), { cinzento: true });
    if (analise.posicoes?.length) {
      r.tabela(
        [
          { titulo: t("ResultadoRastreio.pdfColPosicao"), largura: 0.28 },
          { titulo: t("ResultadoRastreio.pdfColRosto"), largura: 0.24 },
          { titulo: t("ResultadoRastreio.pdfColQualidade"), largura: 0.28 },
          { titulo: t("ResultadoRastreio.pdfColFiavel"), largura: 0.2 },
        ],
        analise.posicoes.map((p) => {
          const chave = POSICOES[p.posicao.toUpperCase()];
          const q = p.qualidade_captura;
          return [
            chave ? t(chave) : p.posicao,
            simNao(p.rosto_detetado),
            q ? `${Math.round(q.pontuacao * 100)}/100` : t("ResultadoRastreio.semDado"),
            simNao(q?.fiavel),
          ];
        }),
      );
    }
    const nota = textoDoScannerNoIdioma(analise.recomendacao);
    if (nota) {
      r.seccao(t("ResultadoRastreio.notaAnalise"));
      r.paragrafo(nota);
    }
  }

  r.seccao(t("ResultadoRastreio.proximoPasso"));
  r.paragrafo(t(PROXIMO[conclusao]));

  r.seccao(t("ResultadoRastreio.pdfSecAviso"));
  r.paragrafo(t("ResultadoRastreio.pdfAvisoTexto"));
}

/**
 * jsPDF `addImage` exige um data URL: o URL que o Vite dá ao importar uma
 * imagem não é aceite de forma fiável entre browsers. Desenha-se num canvas
 * só para tirar o base64.
 */
export const carregarImagemComoDataUrl = (src: string) =>
  new Promise<{ dataUrl: string; largura: number; altura: number }>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("canvas"));
      ctx.drawImage(img, 0, 0);
      resolve({ dataUrl: canvas.toDataURL("image/png"), largura: img.naturalWidth, altura: img.naturalHeight });
    };
    img.onerror = () => reject(new Error("imagem"));
    img.src = src;
  });
