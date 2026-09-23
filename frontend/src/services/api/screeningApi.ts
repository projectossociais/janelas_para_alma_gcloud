import i18n from "@/i18n";
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
    throw new Error(i18n.t("screeningApi.erroNaAnalise", { status: response.status, errorText }));
  }

  return response.json();
}