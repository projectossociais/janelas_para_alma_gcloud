/**
 * Números mostrados na capa da página inicial (pedido da coordenação, 2026-11-08).
 *
 * Vêm do pitch deck do Desafio Genial (Novembro de 2026). Para os actualizar, muda-se só
 * o `valor` aqui (e, se a frase mudar, o texto da chave em `Inicio.numeros.*` nos dois
 * ficheiros de idioma). Nunca pôr aqui um número que não tenha fonte.
 */
export interface NumeroCapa {
  /** O número já escrito como se mostra (ex.: "1.200+"). */
  valor: string;
  /** Chave de tradução da legenda, em `Inicio.numeros`. */
  legenda: string;
}

export const NUMEROS_CAPA: readonly NumeroCapa[] = [
  // Campanha Meu Kamba Estrábico, Gamek, 12 de Setembro de 2026.
  { valor: "197", legenda: "Inicio.numeros.pessoasSensibilizadas" },
  // Comunidade "O Meu Olhar É Mesmo Assim".
  { valor: "118", legenda: "Inicio.numeros.membrosMoam" },
  // Programa Meu Kamba.
  { valor: "15", legenda: "Inicio.numeros.voluntariosKamba" },
  // Exercícios na plataforma.
  { valor: "8", legenda: "Inicio.numeros.exerciciosVisuais" },
];
