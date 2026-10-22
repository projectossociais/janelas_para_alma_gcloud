/**
 * Desafio da Agulha: visão em profundidade no dia-a-dia, num jogo de família
 * com objectos de casa (desde 2026-10-21, sem óculos; o Teste de
 * Estereopsia com óculos 3D fica como opção).
 *
 * Tocar ponta com ponta em dois lápis (o teste dos dois lápis de Lang) ou
 * enfiar uma palhinha no gargalo de uma garrafa, com os dois olhos e depois
 * com um tapado. Com visão em profundidade, os dois olhos juntos acertam mais
 * e mais depressa; quando corre igual com um olho só, os dois olhos não estão
 * a ajudar -- é para mostrar ao médico. O telemóvel é o árbitro: escolhe a
 * vez, conta 3-2-1, cronometra e dá os pontos.
 *
 * Funções puras -- o jogo vive em `pages/exercises/DesafioAgulha.tsx`.
 */
import type { Olho } from "./resultados";

export type Material = "lapis" | "palhinha";
export const MATERIAIS: readonly Material[] = ["lapis", "palhinha"];
export type Condicao = "dois" | "um";

/** Rondas de cada jogador em cada condição. */
export const RONDAS_POR_CONDICAO = 3;
/** Sem resposta neste tempo, a ronda conta como falhada. */
export const TEMPO_MAX_S = 6;

export interface Ronda {
  /** 0 = quem faz o treino (o relatório é dele); 1 = o outro jogador da família. */
  jogador: 0 | 1;
  condicao: Condicao;
  /** Com um olho: qual se tapa (alterna). */
  olhoTapado: Olho;
}

/** Primeiro com os dois olhos, depois com um, a alternar os jogadores e o olho tapado. */
export function planoDeRondas(jogadores: 1 | 2): Ronda[] {
  const rondas: Ronda[] = [];
  for (const condicao of ["dois", "um"] as const)
    for (let k = 0; k < RONDAS_POR_CONDICAO; k++)
      for (let j = 0; j < jogadores; j++) rondas.push({ jogador: j as 0 | 1, condicao, olhoTapado: k % 2 ? "direito" : "esquerdo" });
  return rondas;
}

export interface ResultadoRonda {
  jogador: 0 | 1;
  condicao: Condicao;
  acertou: boolean;
  segundos: number;
}

/** 10 pontos por acerto, mais um bónus por rapidez. */
export const pontosDaRonda = (acertou: boolean, segundos: number): number =>
  acertou ? 10 + Math.max(0, Math.round((TEMPO_MAX_S - segundos) * 2)) : 0;

export type Vantagem = "grande" | "pequena" | "nenhuma";

export interface ResumoJogador {
  acertosDois: number;
  acertosUm: number;
  /** Tempo médio dos acertos; `null` sem acertos nessa condição. */
  tempoDois: number | null;
  tempoUm: number | null;
  pontos: number;
  /** Quanto os dois olhos ajudaram em relação a um só. */
  vantagem: Vantagem;
}

const media = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

export function resumirJogador(res: readonly ResultadoRonda[], jogador: 0 | 1): ResumoJogador {
  const dele = res.filter((r) => r.jogador === jogador);
  const de = (c: Condicao) => dele.filter((r) => r.condicao === c);
  const acertos = (c: Condicao) => de(c).filter((r) => r.acertou);
  const acertosDois = acertos("dois").length;
  const acertosUm = acertos("um").length;
  const tempoDois = media(acertos("dois").map((r) => r.segundos));
  const tempoUm = media(acertos("um").map((r) => r.segundos));
  const vantagem: Vantagem =
    acertosDois - acertosUm >= 2 || (acertosDois >= acertosUm && tempoDois !== null && tempoUm !== null && tempoUm > tempoDois * 1.4)
      ? "grande"
      : acertosDois <= acertosUm && (tempoUm === null || tempoDois === null || tempoUm <= tempoDois * 1.15)
        ? "nenhuma"
        : "pequena";
  return {
    acertosDois,
    acertosUm,
    tempoDois,
    tempoUm,
    pontos: dele.reduce((p, r) => p + pontosDaRonda(r.acertou, r.segundos), 0),
    vantagem,
  };
}
