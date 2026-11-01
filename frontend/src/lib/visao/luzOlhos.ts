/**
 * Luz nos Olhos: o adulto examina o desvio dos olhos da criança, em casa,
 * sem câmara (versão 2, desde 2026-10-31; a versão 1, de 2026-10-21, usava o
 * ecrã branco como luz e marcava-se o reflexo ao milímetro num desenho).
 *
 * O adulto segura o telemóvel logo abaixo dos olhos, com o ecrã virado para
 * si e a lanterna (nas costas do telemóvel) virada para a criança, a um
 * braço. A página não consegue acender a lanterna: ensina a ligá-la no menu.
 *
 * 1. Reflexo da luz (método de Hirschberg): em cada olho vê-se um pontinho
 *    de luz. Responde-se por desenhos: estão no mesmo sítio? em que olho
 *    está fora? para que lado? quão longe do centro (quatro posições)? O
 *    pontinho fica deslocado para o lado contrário ao desvio do olho; cada
 *    milímetro vale cerca de 15 Δ.
 * 2. Teste de tapar: tapa-se um olho e vê-se se o outro se mexe para olhar
 *    para a luz -- se se mexe, estava desviado (para o lado contrário).
 * 3. Diário: com que frequência a família viu um olho a fugir na semana.
 *
 * Funções puras -- o ecrã vive em `pages/exercises/TesteLuzOlhos.tsx`.
 */
import type { Olho } from "./resultados";

/** Raio da íris e da pupila no desenho, em mm (íris de 12 mm, pupila de 4 mm). */
export const IRIS_RAIO_MM = 6;
export const PUPILA_RAIO_MM = 2;
/** Hirschberg: cerca de 15 Δ por milímetro de deslocamento do reflexo. */
export const DELTA_POR_MM = 15;

/** O que se viu nos dois pontinhos (ou porque não se viu). */
export type RespostaLuz = "iguais" | "diferente" | "naovi" | "sem_lanterna";

/** Para que lado do olho está o pontinho, como o adulto vê. */
export type Lado = "orelha" | "nariz" | "cima" | "baixo";
export const LADOS: readonly Lado[] = ["orelha", "nariz", "cima", "baixo"];

/** As quatro posições do pontinho que um adulto distingue a olho, do centro para fora. */
export type Nivel = "pouco" | "pupila" | "meio" | "iris";
export const NIVEIS: readonly { nivel: Nivel; mm: number }[] = [
  { nivel: "pouco", mm: 1 },
  { nivel: "pupila", mm: PUPILA_RAIO_MM },
  { nivel: "meio", mm: 4 },
  { nivel: "iris", mm: IRIS_RAIO_MM },
];

/**
 * Onde está o pontinho, em mm a partir do centro da pupila, como o adulto vê
 * a criança de frente: x para a direita do adulto, y para baixo.
 */
export interface Reflexo {
  x: number;
  y: number;
}

/** De frente, o olho direito da criança fica à esquerda do adulto: o lado do nariz é +x no olho direito e -x no esquerdo. */
const NARIZ_X: Record<Olho, number> = { direito: 1, esquerdo: -1 };

/** Onde desenhar o pontinho de um olho para um lado e uma distância (mm). */
export function reflexoNoDesenho(olho: Olho, lado: Lado, mm: number): Reflexo {
  if (lado === "cima") return { x: 0, y: -mm };
  if (lado === "baixo") return { x: 0, y: mm };
  return { x: (lado === "nariz" ? 1 : -1) * NARIZ_X[olho] * mm, y: 0 };
}

/** O pequeno desvio natural do reflexo para o nariz, igual nos dois olhos (não conta). */
export const reflexoNatural = (olho: Olho): Reflexo => ({ x: 0.35 * NARIZ_X[olho], y: 0 });

export type Sentido = "dentro" | "fora" | "cima" | "baixo";

export interface Achado {
  olho: Olho;
  /** Para onde o olho está virado. */
  sentido: Sentido;
  mm: number;
  /** Arredondado a 5 Δ: o método não dá mais do que isso. */
  delta: number;
}

/** Pontinho para a orelha = olho virado para dentro; para o nariz = para fora; para cima = olho virado para baixo. */
const SENTIDO_DO_LADO: Record<Lado, Sentido> = { orelha: "dentro", nariz: "fora", cima: "baixo", baixo: "cima" };

/** O desvio que corresponde ao pontinho fora do sítio num olho. */
export function achadoDoReflexo(olho: Olho, lado: Lado, nivel: Nivel): Achado {
  const mm = NIVEIS.find((n) => n.nivel === nivel)?.mm ?? 0;
  return { olho, sentido: SENTIDO_DO_LADO[lado], mm, delta: Math.round((mm * DELTA_POR_MM) / 5) * 5 };
}

/** Como o olho que ficou destapado se mexeu quando se tapou o outro ("dentro" = para o lado do nariz). */
export type Movimento = "nao" | "dentro" | "fora" | "cima" | "baixo" | "naovi";
export const MOVIMENTOS: readonly Movimento[] = ["nao", "dentro", "fora", "cima", "baixo", "naovi"];

const CONTRARIO: Record<Sentido, Sentido> = { dentro: "fora", fora: "dentro", cima: "baixo", baixo: "cima" };

/**
 * Teste de tapar: o olho que se mexe para olhar em frente estava desviado
 * para o lado contrário (mexeu-se para o nariz = estava virado para fora).
 */
export function desvioPeloTapar(movimentos: Partial<Record<Olho, Movimento>>): { olho: Olho; sentido: Sentido }[] {
  return (Object.entries(movimentos) as [Olho, Movimento][])
    .filter(([, m]) => m !== "nao" && m !== "naovi")
    .map(([olho, m]) => ({ olho, sentido: CONTRARIO[m as Sentido] }));
}

/** A luz e o tapar apontam o mesmo olho virado para o mesmo lado. */
export const concordam = (achados: readonly Achado[], tapar: readonly { olho: Olho; sentido: Sentido }[]): boolean =>
  achados.some((a) => tapar.some((p) => p.olho === a.olho && p.sentido === a.sentido));

/** Com que frequência a família viu um olho a fugir nos últimos 7 dias. */
export type Frequencia = "nunca" | "as_vezes" | "muitas_vezes" | "sempre";
export const FREQUENCIAS: readonly Frequencia[] = ["nunca", "as_vezes", "muitas_vezes", "sempre"];
export type Quando = "longe" | "cansaco" | "sol" | "perto";
export const QUANDO: readonly Quando[] = ["longe", "cansaco", "sol", "perto"];

/** O maior desvio estimado pelo reflexo, em Δ (0 sem desvio visível). */
export const desvioMaximo = (achados: readonly Achado[]): number => achados.reduce((m, a) => Math.max(m, a.delta), 0);
