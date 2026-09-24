import i18n from "@/i18n";
import { IDIOMA_EN } from "@/i18n/idiomas";

/**
 * Textos livres que o janelas-scanner-api devolve (`recomendacao`, `detail`
 * de erro) vêm sempre em português. Os conhecidos têm tradução; no site
 * inglês um texto desconhecido nunca é mostrado -- quem chama cai no seu texto
 * traduzido (ex.: a descrição da categoria do diagnóstico).
 */
export const TEXTOS_CONHECIDOS_SCANNER: readonly [RegExp, string][] = [
  [/^não foi possível comparar as posições do olhar\b/i, "screeningApi.posicoesNaoComparaveis"],
];

/** Texto do scanner no idioma actual, ou `null` se não houver versão nele. */
export function textoDoScannerNoIdioma(texto: string | null | undefined): string | null {
  const limpo = texto?.trim();
  if (!limpo) return null;
  if (i18n.language !== IDIOMA_EN) return limpo;
  const conhecido = TEXTOS_CONHECIDOS_SCANNER.find(([padrao]) => padrao.test(limpo));
  return conhecido ? i18n.t(conhecido[1]) : null;
}

export interface ScreeningResponse {
  estado: string;
  posicoes?: Array<{
    posicao: string;
    estado: string;
    rosto_detetado: boolean;
    qualidade_captura?: {
      pontuacao: number;
      fiavel: boolean;
      motivos?: string[];
    };
    alinhamento_ocular?: {
      olho_direito?: {
        posicao_horizontal: number;
        desvio_horizontal: number;
        desvio_vertical: number;
      };
      olho_esquerdo?: {
        posicao_horizontal: number;
        desvio_horizontal: number;
        desvio_vertical: number;
      };
    };
  }>;
  variacao_desalinhamento?: number;
  incomitante?: boolean;
  requer_avaliacao_humana?: boolean;
  recomendacao?: string;
  aviso?: string;
  persistido?: boolean;
  tempo_processamento_ms?: number;
}

// Serviço distinto da API própria do monorepo (que usa VITE_API_URL e fala
// sempre com "/api" na mesma origem — ver src/lib/apiClient.ts). O scanner
// vive num repositório FastAPI à parte (janelas-scanner-api), daí a variável
// própria: reutilizar VITE_API_URL aqui sequestraria o cliente da API própria.
const API_BASE = import.meta.env.VITE_API_SCANNER_URL || 'http://localhost:8001/api/v1';

export async function submeterRastreioMultiGaze(
  imagens: { centro: Blob; esquerda: Blob; direita: Blob },
  token?: string
): Promise<ScreeningResponse> {
  const formData = new FormData();
  formData.append('centro', imagens.centro, 'centro.jpg');
  formData.append('esquerda', imagens.esquerda, 'esquerda.jpg');
  formData.append('direita', imagens.direita, 'direita.jpg');

  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/screening/multi-gaze`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    // `status` e `detail` como os erros da API própria: no site inglês o
    // `mensagemDeErroApi` traduz pelo texto conhecido ou pelo código HTTP, e
    // nunca mostra o texto português do microserviço.
    throw Object.assign(new Error(i18n.t("screeningApi.erroNaAnalise", { status: response.status, errorText })), {
      status: response.status,
      detail: detalheDoErro(errorText),
    });
  }

  return response.json();
}

/** `detail` de uma resposta de erro FastAPI (`{"detail": "..."}`), se houver. */
function detalheDoErro(corpo: string): string | undefined {
  try {
    const detail = (JSON.parse(corpo) as { detail?: unknown } | null)?.detail;
    return typeof detail === "string" ? detail : undefined;
  } catch {
    return undefined;
  }
}
