/**
 * Números mostrados na capa da página inicial (pedido da coordenação, 2026-11-08).
 *
 * Vêm do pitch deck do Desafio Genial (Novembro de 2026). Para os actualizar, muda-se só
 * o `valor` aqui (e, se a frase mudar, o texto da chave em `Inicio.numeros.*` nos dois
 * ficheiros de idioma). Nunca pôr aqui um número que não tenha fonte.
 */
export interface NumeroCapa {
  /** O número já escrito como se mostra (ex.: "197+", "≈293 mil"). */
  valor: string;
  /** Chave de tradução da legenda, em `Inicio.numeros`. */
  legenda: string;
}

export const NUMEROS_CAPA: readonly NumeroCapa[] = [
  // Estimativa do pitch deck (36,6 M de habitantes; prevalência de ~0,8%). Sempre com "≈".
  { valor: "≈293 mil", legenda: "Inicio.numeros.estrabismoAngola" },
  // Campanha Meu Kamba Estrábico, Gamek, 12 de Setembro de 2026.
  { valor: "197+", legenda: "Inicio.numeros.pessoasSensibilizadas" },
  // Comunidade "O Meu Olhar É Mesmo Assim".
  { valor: "118+", legenda: "Inicio.numeros.membrosMoam" },
  // Programa Meu Kamba (30, corrigido pela coordenação a 2026-11-09; o deck dizia 15).
  { valor: "30+", legenda: "Inicio.numeros.voluntariosKamba" },
  // Exercícios na plataforma: são exactamente 8, por isso sem "+".
  { valor: "8", legenda: "Inicio.numeros.exerciciosVisuais" },
];
