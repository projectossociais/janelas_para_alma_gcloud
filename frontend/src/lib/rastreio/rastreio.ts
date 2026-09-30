import type { ScreeningResponse } from "@/services/api/screeningApi";

/**
 * Lógica pura do rastreio (sem React, sem rede), extraída de `Scanner.tsx`
 * sem mudar o comportamento, para ser testada à parte.
 */

/** Luminância média mínima (0-255) para uma fotografia utilizável. */
export const LUMINANCIA_MINIMA = 55;

/** Luminância média de uma imagem RGBA (ImageData.data). `null` se vazia. */
export function luminanciaMedia(rgba: ArrayLike<number>): number | null {
  const pixels = Math.floor(rgba.length / 4);
  if (pixels === 0) return null;
  let soma = 0;
  for (let i = 0; i < pixels * 4; i += 4) {
    soma += 0.2126 * (rgba[i] ?? 0) + 0.7152 * (rgba[i + 1] ?? 0) + 0.0722 * (rgba[i + 2] ?? 0);
  }
  return soma / pixels;
}

/** "data:image/jpeg;base64,..." → Blob. `null` se o formato não for válido. */
export function dataUrlParaBlob(dataUrl: string): Blob | null {
  const [cabecalho, b64] = dataUrl.split(",");
  if (!cabecalho || !b64) return null;
  const tipo = /:(.*?);/.exec(cabecalho)?.[1] ?? "image/jpeg";
  const binario = atob(b64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return new Blob([bytes], { type: tipo });
}

/** O único sinal que o janelas-scanner-api calcula hoje (CLAUDE.md §11). */
export const requerAvaliacao = (r: ScreeningResponse) => !!(r.incomitante || r.requer_avaliacao_humana);

const posicaoCentro = (r: ScreeningResponse) => r.posicoes?.find((p) => p.posicao.toUpperCase() === "CENTRO");

/**
 * O que se grava na API própria: **só as medições**, nunca uma imagem
 * (CLAUDE.md §4, regra 4: imagens faciais de crianças não se guardam).
 */
export function paraRegistoScreening(r: ScreeningResponse) {
  const centro = posicaoCentro(r);
  return {
    estado: r.estado,
    rosto_detetado: r.posicoes?.some((p) => p.rosto_detetado) ?? false,
    requer_avaliacao_humana: r.requer_avaliacao_humana ?? false,
    diagnostico: requerAvaliacao(r) ? ("requer_avaliacao" as const) : ("normal" as const),
    assimetria_horizontal: r.variacao_desalinhamento ?? null,
    qualidade_captura: centro?.qualidade_captura?.pontuacao ?? null,
    qualidade_fiavel: centro?.qualidade_captura?.fiavel ?? null,
    qualidade_motivos: centro?.qualidade_captura?.motivos ?? [],
    medicoes: r as unknown as Record<string, unknown>,
    versao_analise: "janelas-scanner-api/multi-gaze",
  };
}

/**
 * O resultado para o ecrã de resultados (guardado em `sessionStorage`, chave
 * `scanResult`, lido por `ScannerResultados.tsx`). As duas chaves de
 * diagnóstico são valores estáveis, não texto de interface.
 */
export const DIAGNOSTICO_NORMAL = "Alinhamento Fisiológico Normal";
export const DIAGNOSTICO_AVALIACAO = "Necessária Avaliação Oftalmológica";
export const CHAVE_RESULTADO = "scanResult";

export function paraResultadoEcra(r: ScreeningResponse, agora = new Date()) {
  const pontuacao = posicaoCentro(r)?.qualidade_captura?.pontuacao;
  return {
    diagnosis: requerAvaliacao(r) ? DIAGNOSTICO_AVALIACAO : DIAGNOSTICO_NORMAL,
    confidence: pontuacao ? Math.round(pontuacao * 100) : 92,
    date: agora.toISOString(),
    apiData: r,
  };
}
