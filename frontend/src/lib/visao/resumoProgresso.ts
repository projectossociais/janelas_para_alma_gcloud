import { diaLocal, minutosPorDia, sequenciaDeDias, ultimosDias, type SessaoResumo } from "./progresso";

/**
 * Contas do ecrã "O meu progresso", sem React (testadas à parte). Duas peças:
 * a actividade dos últimos dias (minutos de treino que contam para a dose) e a
 * série dos limiares de um exercício, por olho, para o gráfico.
 */

export const DIAS_ACTIVIDADE = 14;

export interface DiaDeActividade {
  /** `AAAA-MM-DD`, no fuso local. */
  dia: string;
  minutos: number;
  hoje: boolean;
}

export interface Actividade {
  dias: DiaDeActividade[];
  /** Soma dos minutos que contam, arredondada ao minuto. */
  totalMinutos: number;
  /** Quantos dos dias tiveram treino que conta. */
  diasComTreino: number;
  /** Dias seguidos com treino, até hoje (ou ontem). */
  sequencia: number;
  /** O dia com mais minutos (escala das barras); pelo menos 1, para não dividir por 0. */
  maximo: number;
}

export function actividade(sessoes: readonly SessaoResumo[], hoje: Date, n = DIAS_ACTIVIDADE): Actividade {
  const porDia = minutosPorDia(sessoes);
  const hojeStr = diaLocal(hoje);
  const dias = ultimosDias(hoje, n).map((dia) => ({ dia, minutos: porDia.get(dia) ?? 0, hoje: dia === hojeStr }));
  const total = dias.reduce((s, d) => s + d.minutos, 0);
  return {
    dias,
    totalMinutos: Math.round(total),
    diasComTreino: dias.filter((d) => d.minutos > 0).length,
    sequencia: sequenciaDeDias(sessoes, hoje),
    maximo: Math.max(1, ...dias.map((d) => d.minutos)),
  };
}

export interface PontoDaSerie {
  /** `AAAA-MM-DD`: um ponto por dia, nunca duas datas iguais no eixo. */
  dia: string;
  direito?: number;
  esquerdo?: number;
}

/**
 * Os limiares de um exercício, um ponto por dia e por olho. Com várias sessões
 * no mesmo dia, conta a última desse dia (é a que a pessoa fez depois de
 * aquecer, e é a que o relatório mostra como "último resultado"). Ordenado do
 * mais antigo para o mais recente.
 */
export function serieDeLimiares(sessoes: readonly SessaoResumo[], exercicioId: string): PontoDaSerie[] {
  const validas = sessoes
    .filter(
      (s) =>
        s.exercicio_id === exercicioId &&
        typeof s.limiar === "number" &&
        (s.olho === "direito" || s.olho === "esquerdo") &&
        // Baixa atenção não é medição fiável: fora do gráfico, como já da tendência.
        s.sinais?.baixa_atencao !== true,
    )
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const porDia = new Map<string, PontoDaSerie>();
  for (const s of validas) {
    const dia = diaLocal(new Date(s.created_at));
    const ponto = porDia.get(dia) ?? { dia };
    ponto[s.olho as "direito" | "esquerdo"] = s.limiar as number;
    porDia.set(dia, ponto);
  }
  return [...porDia.values()].sort((a, b) => a.dia.localeCompare(b.dia));
}

/**
 * O eixo vertical do gráfico, com marcas certas: o gráfico, por si, escolhia
 * marcas como 0,35 e o arredondamento a uma casa escrevia "0,3" num sítio que
 * não é 0,3 (caso real, 2026-10-08). Aqui o intervalo vai de 0,1 abaixo do
 * menor valor a 0,1 acima do maior, em décimas exactas, e as marcas caem sempre
 * em décimas (de 0,1 em 0,1; de 0,2 em 0,2 se fossem mais de 8).
 */
export function eixoDosLimiares(serie: readonly PontoDaSerie[]): { dominio: [number, number]; marcas: number[] } {
  const valores = serie.flatMap((p) => [p.direito, p.esquerdo]).filter((v): v is number => typeof v === "number");
  if (!valores.length) return { dominio: [0, 1], marcas: [0, 0.5, 1] };
  // Em décimas inteiras, para nunca acumular erros de vírgula flutuante (0,1 + 0,2).
  const baixo = Math.floor(Math.min(...valores) * 10 + 1e-9) - 1;
  const alto = Math.ceil(Math.max(...valores) * 10 - 1e-9) + 1;
  const passo = alto - baixo > 8 ? 2 : 1;
  const inicio = Math.floor(baixo / passo) * passo;
  const marcas: number[] = [];
  for (let d = inicio; d <= alto; d += passo) marcas.push(d / 10);
  if (marcas[marcas.length - 1] < alto / 10) marcas.push((marcas[marcas.length - 1] * 10 + passo) / 10);
  return { dominio: [marcas[0], marcas[marcas.length - 1]], marcas };
}

/**
 * Os olhos com resultados num exercício. Um treino monocular (ex.: Anéis, só com
 * o olho mais fraco) nunca deve aparecer com o outro olho a pedir "mais uma
 * sessão": seria um conselho errado, lido pelo médico (caso real, 2026-10-08).
 */
export function olhosComResultados(sessoes: readonly SessaoResumo[], exercicioId: string): ("direito" | "esquerdo")[] {
  const com = new Set(
    sessoes
      .filter((s) => s.exercicio_id === exercicioId && typeof s.limiar === "number")
      .map((s) => s.olho)
      .filter((o): o is "direito" | "esquerdo" => o === "direito" || o === "esquerdo"),
  );
  return (["direito", "esquerdo"] as const).filter((o) => com.has(o));
}
