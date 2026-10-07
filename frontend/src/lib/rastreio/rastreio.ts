import type { ResultadoRastreioCompleto } from "@/lib/apiClient";
import type { DicaRepeticao, MedicoesParaApi } from "@/lib/rastreio/captura/sessaoCompleta";
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

const posicaoCentro = (r: ScreeningResponse) => r.posicoes?.find((p) => p.posicao.toUpperCase() === "CENTRO");

/** Variação do desalinhamento entre posições (dentro de `motilidade`). */
export const variacaoDesalinhamento = (r: ScreeningResponse): number | null =>
  typeof r.motilidade?.variacao_desalinhamento === "number" ? r.motilidade.variacao_desalinhamento : null;

/** O desvio muda com a direcção do olhar? `null` se não se comparou. */
export const incomitancia = (r: ScreeningResponse): boolean | null =>
  typeof r.motilidade?.incomitante === "boolean" ? r.motilidade.incomitante : null;

/** Desalinhamento entre os olhos a olhar em frente (fracção da largura do olho). */
export const desalinhamentoEmFrente = (r: ScreeningResponse): number | null => {
  const v = posicaoCentro(r)?.alinhamento_ocular?.assimetria_horizontal;
  return typeof v === "number" ? v : null;
};

/** O único sinal que o janelas-scanner-api calcula hoje (CLAUDE.md §11). */
export const requerAvaliacao = (r: ScreeningResponse) => !!(incomitancia(r) || r.requer_avaliacao_humana);

/**
 * O que se grava na API própria: **só as medições**, nunca uma imagem
 * (CLAUDE.md §4, regra 4: imagens faciais de crianças não se guardam).
 */
export function paraRegistoScreening(r: ScreeningResponse) {
  const centro = posicaoCentro(r);
  // O histórico diz o que a pessoa viu: "inconclusivo" nunca se grava como "normal".
  const conclusao = conclusaoDoRastreio(requerAvaliacao(r) ? DIAGNOSTICO_AVALIACAO : DIAGNOSTICO_NORMAL, r);
  const diagnostico = (
    { avaliacao: "requer_avaliacao", normal: "normal", inconclusivo: "inconclusivo" } as const
  )[conclusao];
  return {
    estado: r.estado,
    rosto_detetado: r.posicoes?.some((p) => p.rosto_detetado) ?? false,
    requer_avaliacao_humana: r.requer_avaliacao_humana ?? false,
    diagnostico,
    assimetria_horizontal: desalinhamentoEmFrente(r),
    assimetria_vertical: posicaoCentro(r)?.alinhamento_ocular?.assimetria_vertical ?? null,
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

/**
 * O que o ecrã de resultados diz, a partir do que a análise devolveu:
 *
 * - `avaliacao`: a análise pediu avaliação (o único sinal que ela calcula hoje).
 *   Tem prioridade: na dúvida, encaminha-se para o médico. Excepção: se não
 *   mediu nada (sem variação nem incomitância) e alguma fotografia foi fraca, o
 *   pedido vem da falta de medição, não de um sinal: é `inconclusivo`.
 * - `inconclusivo`: não pediu avaliação, mas alguma fotografia não teve rosto
 *   ou não foi fiável. Um "normal" tirado de fotografias fracas não se mostra
 *   como normal: pede-se para repetir.
 * - `normal`: nenhum sinal, com fotografias fiáveis.
 *
 * Sem os dados da análise (resultado antigo), decide só pelo diagnóstico
 * guardado, e tudo o que não for o normal conta como `avaliacao`.
 */
export type Conclusao = "avaliacao" | "normal" | "inconclusivo";

export function conclusaoDoRastreio(diagnostico: string, analise: ScreeningResponse | null): Conclusao {
  if (!analise) return diagnostico === DIAGNOSTICO_NORMAL ? "normal" : "avaliacao";
  const fraca = (analise.posicoes ?? []).some(
    (p) => !p.rosto_detetado || p.qualidade_captura?.fiavel === false || p.utilizavel === false,
  );
  // O serviço também pede avaliação quando não conseguiu comparar as posições
  // (fotografia fraca, cabeça mexida): aí não viu sinal nenhum, só não mediu, e
  // o que se pede é para repetir. Caso real (2026-10-06): foto direita 39/100,
  // variação "sem dado", e o ecrã dizia "avaliação recomendada".
  if (incomitancia(analise)) return "avaliacao";
  const naoComparou = variacaoDesalinhamento(analise) === null;
  if (analise.requer_avaliacao_humana && !(naoComparou && fraca)) return "avaliacao";
  return fraca || !analise.posicoes?.length ? "inconclusivo" : "normal";
}

/**
 * O que o motor próprio mediu (rastreio completo), em dioptrias prismáticas (Δ).
 * Guardado ao lado do resultado para o ecrã e o relatório mostrarem os números.
 */
export interface ResultadoMotor {
  horizontalDelta: number;
  verticalDelta: number;
  dispersaoDelta: number;
  fotografiasValidas: number;
  fotografiasTotal: number;
  versaoRegra: string;
  motivo: string | null;
  /** O que sugerir ao repetir, quando não se mediu. */
  dica: DicaRepeticao;
}

const CONCLUSAO_DO_MOTOR: Record<ResultadoRastreioCompleto["conclusao"], Conclusao> = {
  encaminhar: "avaliacao",
  sem_sinais: "normal",
  nao_mediu: "inconclusivo",
};

/** O que o ecrã de resultados guarda no fim do rastreio completo. */
export function paraResultadoMotor(
  medicoes: MedicoesParaApi,
  r: ResultadoRastreioCompleto,
  dica: DicaRepeticao,
  agora = new Date(),
) {
  const conclusao = CONCLUSAO_DO_MOTOR[r.conclusao];
  const motor: ResultadoMotor = {
    horizontalDelta: medicoes.horizontal_delta,
    verticalDelta: medicoes.vertical_delta,
    dispersaoDelta: medicoes.dispersao_delta,
    fotografiasValidas: medicoes.fotografias_validas,
    fotografiasTotal: medicoes.fotografias_total,
    versaoRegra: r.versao_regra,
    motivo: r.motivo,
    dica,
  };
  return {
    // Só os dois valores antigos existem como texto; "não mediu" não é nenhum
    // deles, e a conclusão vem sempre de `motor`, nunca daqui.
    diagnosis: conclusao === "normal" ? DIAGNOSTICO_NORMAL : DIAGNOSTICO_AVALIACAO,
    confidence: 0,
    date: agora.toISOString(),
    apiData: null,
    conclusao,
    motor,
  };
}

const DICAS: readonly DicaRepeticao[] = ["semRosto", "longe", "luz", "olhar", "geral"];
const CONCLUSOES: readonly Conclusao[] = ["avaliacao", "normal", "inconclusivo"];
const numero = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function lerMotor(bruto: unknown): ResultadoMotor | null {
  if (!bruto || typeof bruto !== "object") return null;
  const m = bruto as Record<string, unknown>;
  if (
    !numero(m.horizontalDelta) ||
    !numero(m.verticalDelta) ||
    !numero(m.dispersaoDelta) ||
    !numero(m.fotografiasValidas) ||
    !numero(m.fotografiasTotal) ||
    typeof m.versaoRegra !== "string" ||
    !DICAS.includes(m.dica as DicaRepeticao)
  ) {
    return null;
  }
  return {
    horizontalDelta: m.horizontalDelta,
    verticalDelta: m.verticalDelta,
    dispersaoDelta: m.dispersaoDelta,
    fotografiasValidas: m.fotografiasValidas,
    fotografiasTotal: m.fotografiasTotal,
    versaoRegra: m.versaoRegra,
    motivo: typeof m.motivo === "string" ? m.motivo : null,
    dica: m.dica as DicaRepeticao,
  };
}

export interface ResultadoGuardado {
  conclusao: Conclusao;
  data: Date;
  analise: ScreeningResponse | null;
  /** Presente só no rastreio completo (motor próprio). */
  motor?: ResultadoMotor | null;
}

/**
 * Lê o resultado que o rastreio deixou em `sessionStorage`. Nunca confia na
 * forma: um valor estragado ou antigo dá `null` (volta-se ao rastreio), nunca
 * um ecrã partido.
 */
export function lerResultadoGuardado(bruto: string | null): ResultadoGuardado | null {
  if (!bruto) return null;
  try {
    const r = JSON.parse(bruto) as {
      diagnosis?: unknown;
      date?: unknown;
      apiData?: unknown;
      motor?: unknown;
      conclusao?: unknown;
    } | null;
    if (!r || typeof r.diagnosis !== "string" || typeof r.date !== "string") return null;
    const data = new Date(r.date);
    if (Number.isNaN(data.getTime())) return null;
    // Rastreio completo: a conclusão vem do motor e só vale com as medições à vista.
    const motor = lerMotor(r.motor);
    if (motor && CONCLUSOES.includes(r.conclusao as Conclusao)) {
      return { conclusao: r.conclusao as Conclusao, data, analise: null, motor };
    }
    const analise =
      r.apiData && typeof r.apiData === "object" && typeof (r.apiData as ScreeningResponse).estado === "string"
        ? (r.apiData as ScreeningResponse)
        : null;
    return { conclusao: conclusaoDoRastreio(r.diagnosis, analise), data, analise };
  } catch {
    return null;
  }
}
