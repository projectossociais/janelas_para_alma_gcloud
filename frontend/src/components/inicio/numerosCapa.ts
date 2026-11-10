/**
 * Números mostrados na capa da página inicial (pedido da coordenação, 2026-11-08).
 *
 * Vêm do pitch deck do Desafio Genial (Novembro de 2026). Para os actualizar, muda-se só
 * o `valor` aqui (e, se a frase mudar, o texto da chave em `Inicio.numeros.*` nos dois
 * ficheiros de idioma). Nunca pôr aqui um número que não tenha fonte.
 */
export interface NumeroCapa {
  /** O número já escrito como se mostra (ex.: "195+", "293 mil"). */
  valor: string;
  /** Chave de tradução da legenda, em `Inicio.numeros`. */
  legenda: string;
}

export const NUMEROS_CAPA: readonly NumeroCapa[] = [
  // Estimativa (confirmada a 2026-11-09): população do Censo 2024 do INE (36.604.681) ×
  // prevalência de estrabismo em África de 0,8% (IC 95%: 0,4%-1,4%; Akowuah et al., revisão
  // sistemática e meta-análise, Strabismus 2023;31(1):31-44) = 292.837. Não há contagem
  // oficial para Angola (o INE não desagrega o estrabismo), por isso a legenda começa por
  // "Estimativa"; sem o sinal "≈" na capa, a pedido da coordenação.
  { valor: "293 mil", legenda: "Inicio.numeros.estrabismoAngola" },
  // IONA (Instituto Oftalmológico Nacional de Angola), 1.º semestre de 2023: "Dos zero aos 14
  // anos, atendemos a 8.545 crianças. As patologias mais diagnosticadas são: estrabismo,
  // catarata e glaucoma congénito." (directora-geral Luísa Paiva, Novo Jornal, 7-8-2023).
  // Número exacto, por isso sem "+".
  { valor: "8.545", legenda: "Inicio.numeros.criancasIona" },
  // Campanha Meu Kamba Estrábico, Gamek, 12 de Setembro de 2026 (195+ indicado pela coordenação).
  { valor: "195+", legenda: "Inicio.numeros.pessoasSensibilizadas" },
  // Comunidade "O Meu Olhar É Mesmo Assim" (115+ indicado pela coordenação).
  { valor: "115+", legenda: "Inicio.numeros.membrosMoam" },
  // Programa Meu Kamba (30, corrigido pela coordenação a 2026-11-09; o deck dizia 15).
  { valor: "30+", legenda: "Inicio.numeros.voluntariosKamba" },
  // Exercícios na plataforma: são exactamente 8, por isso sem "+".
  { valor: "8", legenda: "Inicio.numeros.exerciciosVisuais" },
];
