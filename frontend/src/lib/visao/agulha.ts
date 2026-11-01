/**
 * Desafio da Agulha: visão em profundidade no dia-a-dia, com um lápis e um
 * dedo (versão 2, desde 2026-11-01, sem óculos; o Teste de Estereopsia com
 * óculos 3D fica como opção). A versão 1 (2026-10-21) era um jogo de dois
 * jogadores, com dois lápis ou palhinha na garrafa, pontos e cronómetro --
 * saiu por ser difícil de perceber.
 *
 * O adulto segura um lápis de pé, a um braço da criança; ela desce o dedo de
 * cima e tenta tocar na ponta de uma só vez (o teste dos lápis de Lang, com o
 * dedo no lugar do segundo lápis). Cinco tentativas com os dois olhos e cinco
 * com um tapado (o tapado alterna). Com visão em profundidade, os dois olhos
 * juntos acertam bem mais; quando corre igual com um olho só, os dois olhos
 * não estão a ajudar -- é para mostrar ao médico. O adulto é o árbitro: toca
 * em Acertou ou Falhou.
 *
 * Funções puras -- o desafio vive em `pages/exercises/DesafioAgulha.tsx`.
 */
import type { Olho } from "./resultados";

export type Condicao = "dois" | "um";
export const CONDICOES: readonly Condicao[] = ["dois", "um"];

/** Tentativas em cada condição. */
export const TENTATIVAS = 5;

/** Com um olho, o tapado alterna: esquerdo, direito, esquerdo... */
export const olhoTapado = (tentativa: number): Olho => (tentativa % 2 ? "direito" : "esquerdo");

export type Vantagem = "grande" | "pequena" | "nenhuma";

/**
 * Quanto os dois olhos ajudaram: 2 ou mais acertos a mais com os dois olhos
 * é uma vantagem clara; 1 é pouco para concluir (repetir noutro dia); igual
 * ou pior é sinal para o médico.
 */
export function vantagemDe(acertosDois: number, acertosUm: number): Vantagem {
  const dif = acertosDois - acertosUm;
  return dif >= 2 ? "grande" : dif === 1 ? "pequena" : "nenhuma";
}

export interface ResumoAgulha {
  acertosDois: number;
  acertosUm: number;
  vantagem: Vantagem;
}

export function resumirAgulha(tentativas: Record<Condicao, readonly boolean[]>): ResumoAgulha {
  const acertosDois = tentativas.dois.filter(Boolean).length;
  const acertosUm = tentativas.um.filter(Boolean).length;
  return { acertosDois, acertosUm, vantagem: vantagemDe(acertosDois, acertosUm) };
}
