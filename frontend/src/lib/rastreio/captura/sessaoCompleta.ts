import type { Circulo } from "../analise/tipos";
import { falha, sucesso } from "../analise/tipos";
import {
  agregarSessao,
  FOTOGRAFIAS_VALIDAS_MINIMAS,
  type MotivoFalhaFotografia,
  type ResultadoFotografia,
  type ResultadoSessao,
} from "../analise/sessao";
import type { DesvioBinocular } from "../analise/binocular";

/**
 * O rastreio completo, do lado do telemóvel: mede cada fotografia com o motor,
 * junta-as numa sessão e prepara o que se envia à API (só números, nunca uma
 * imagem: CLAUDE.md §4, regra 4). A decisão do que as medições querem dizer é da
 * API (`ClassificacaoRastreioService`), não daqui.
 *
 * O detector e a medição entram por parâmetro: assim testa-se sem MediaPipe nem
 * canvas, e o ecrã passa as implementações reais.
 */

export const VERSAO_MOTOR = "jpa-motor-rastreio/2026-10-v1";

export interface AnaliseUmaFoto {
  desvio: DesvioBinocular | null;
  motivo: string | null;
}

export interface DependenciasAnalise<Foto> {
  detectarIris: (foto: Foto) => Promise<[Circulo, Circulo] | null>;
  analisarFoto: (foto: Foto, iris: [Circulo, Circulo]) => AnaliseUmaFoto;
  /** Chamado a cada fotografia acabada (para o ecrã mostrar o progresso). */
  aoProgredir?: (feita: number, total: number) => void;
}

export async function medirFotografias<Foto>(
  fotos: readonly Foto[],
  dep: DependenciasAnalise<Foto>,
): Promise<ReturnType<typeof agregarSessao>> {
  const resultados: ResultadoFotografia[] = [];
  for (const [i, foto] of fotos.entries()) {
    resultados.push(await medirUma(foto, dep));
    dep.aoProgredir?.(i + 1, fotos.length);
  }
  return agregarSessao(resultados);
}

async function medirUma<Foto>(foto: Foto, dep: DependenciasAnalise<Foto>): Promise<ResultadoFotografia> {
  let iris: [Circulo, Circulo] | null;
  try {
    iris = await dep.detectarIris(foto);
  } catch {
    iris = null;
  }
  if (!iris) return falha("sem-rosto");
  const a = dep.analisarFoto(foto, iris);
  if (a.desvio) return sucesso(a.desvio);
  return falha((a.motivo ?? "sem-reflexo") as MotivoFalhaFotografia);
}

/** O corpo de `POST /rastreio-completo` (schema `MedicoesRastreioCriar`). */
export interface MedicoesParaApi {
  horizontal_delta: number;
  vertical_delta: number;
  dispersao_delta: number;
  fotografias_validas: number;
  fotografias_total: number;
  falha: string | null;
  versao_motor: string;
}

export function paraMedicoesApi(sessao: ReturnType<typeof agregarSessao>): MedicoesParaApi {
  if (sessao.ok === true) {
    const s: ResultadoSessao = sessao.valor;
    return {
      horizontal_delta: s.horizontalDelta,
      vertical_delta: s.verticalDelta,
      dispersao_delta: s.dispersaoDelta,
      fotografias_validas: s.fotografiasValidas,
      fotografias_total: s.fotografiasTotal,
      falha: null,
      versao_motor: VERSAO_MOTOR,
    };
  }
  const falhada = sessao as Extract<typeof sessao, { ok: false }>;
  const d = falhada.detalhe;
  const totalFalhas = Object.values(d?.falhas ?? {}).reduce((a, n) => a + (n ?? 0), 0);
  const total = d?.fotografiasTotal ?? 0;
  return {
    horizontal_delta: 0,
    vertical_delta: 0,
    dispersao_delta: 0,
    fotografias_validas: Math.max(0, total - totalFalhas),
    fotografias_total: total,
    // O motivo que a API devolve: "poucas-fotografias-validas" ou "medicoes-inconsistentes".
    falha: falhada.motivo,
    versao_motor: VERSAO_MOTOR,
  };
}

/** Dicas de repetição, pelo motivo mais frequente das fotografias que falharam. */
export type DicaRepeticao = "semRosto" | "longe" | "luz" | "olhar" | "geral";

export function dicaDeRepeticao(sessao: ReturnType<typeof agregarSessao>): DicaRepeticao {
  if (sessao.ok === true) return "geral";
  if (sessao.motivo === "medicoes-inconsistentes") return "olhar";
  const falhas = Object.entries(sessao.detalhe?.falhas ?? {}) as [MotivoFalhaFotografia, number][];
  const [principal] = falhas.sort((a, b) => b[1] - a[1])[0] ?? [];
  switch (principal) {
    case "sem-rosto":
      return "semRosto";
    case "iris-pequena":
      return "longe";
    case "sem-reflexo":
    case "reflexos-multiplos":
    case "reflexo-difuso":
    case "reflexo-fora-da-iris":
      return "luz";
    default:
      return "geral";
  }
}

export { FOTOGRAFIAS_VALIDAS_MINIMAS };
