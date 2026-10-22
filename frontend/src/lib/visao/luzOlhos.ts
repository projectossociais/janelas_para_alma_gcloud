/**
 * Luz nos Olhos: o adulto examina o desvio dos olhos da criança, em casa,
 * sem câmara (desde 2026-10-21, no lugar do Teste de Astigmatismo).
 *
 * 1. Reflexo da luz (método de Hirschberg): com o ecrã a servir de luz, a
 *    meio metro, o adulto vê um pontinho de luz em cada olho e marca-o num
 *    desenho. Num olho direito, o reflexo fica quase no centro da pupila;
 *    num olho desviado, fica deslocado para o lado contrário do desvio. Cada
 *    milímetro de diferença entre os olhos vale cerca de 15 Δ.
 * 2. Teste de tapar: tapa-se um olho e vê-se se o outro se mexe para olhar
 *    em frente -- se se mexe, estava desviado (para o lado contrário).
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
/** Diferenças abaixo disto não se distinguem a olho: não contam. */
export const MINIMO_MM = 0.5;

/**
 * Onde o adulto viu o reflexo, em mm a partir do centro da pupila, como o
 * adulto vê a criança de frente: x para a direita do adulto, y para baixo.
 */
export interface Reflexo {
  x: number;
  y: number;
}

export type Sentido = "dentro" | "fora" | "cima" | "baixo";

export interface Achado {
  olho: Olho;
  /** Para onde o olho está virado. */
  sentido: Sentido;
  mm: number;
  /** Arredondado a 5 Δ: o método não dá mais do que isso. */
  delta: number;
}

/**
 * Reflexos -> desvio. De frente, o olho direito da criança fica do lado
 * esquerdo do adulto: o lado do nariz é +x no olho direito e -x no esquerdo.
 * O olho que fixa é o de reflexo mais central; o outro compara-se com ele
 * (assim, o pequeno desvio natural do reflexo para o nariz, igual nos dois
 * olhos, não conta).
 */
export function analisarReflexos(r: Record<Olho, Reflexo>): Achado[] {
  const nariz = { direito: { n: r.direito.x, u: -r.direito.y }, esquerdo: { n: -r.esquerdo.x, u: -r.esquerdo.y } };
  const distancia = (o: { n: number; u: number }) => Math.hypot(o.n, o.u);
  const fixa: Olho = distancia(nariz.direito) <= distancia(nariz.esquerdo) ? "direito" : "esquerdo";
  const outro: Olho = fixa === "direito" ? "esquerdo" : "direito";
  const n = nariz[outro].n - nariz[fixa].n;
  const u = nariz[outro].u - nariz[fixa].u;
  const achados: Achado[] = [];
  const achar = (mm: number, sentido: Sentido) =>
    achados.push({ olho: outro, sentido, mm: Math.round(mm * 10) / 10, delta: Math.round((mm * DELTA_POR_MM) / 5) * 5 });
  // Reflexo para o lado do nariz = olho virado para fora; para a orelha = para dentro.
  if (Math.abs(n) >= MINIMO_MM) achar(Math.abs(n), n > 0 ? "fora" : "dentro");
  // Reflexo para cima = olho virado para baixo, e vice-versa.
  if (Math.abs(u) >= MINIMO_MM) achar(Math.abs(u), u > 0 ? "baixo" : "cima");
  return achados;
}

/** Como o olho que ficou destapado se mexeu quando se tapou o outro. */
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

/** Com que frequência a família viu um olho a fugir nos últimos 7 dias. */
export type Frequencia = "nunca" | "as_vezes" | "muitas_vezes" | "sempre";
export const FREQUENCIAS: readonly Frequencia[] = ["nunca", "as_vezes", "muitas_vezes", "sempre"];
export type Quando = "longe" | "cansaco" | "sol" | "perto";
export const QUANDO: readonly Quando[] = ["longe", "cansaco", "sol", "perto"];

/** O maior desvio estimado pelo reflexo, em Δ (0 sem desvio visível). */
export const desvioMaximo = (achados: readonly Achado[]): number => achados.reduce((m, a) => Math.max(m, a.delta), 0);

/** Um reflexo marcado fora da íris fica na borda dela. */
export function limitarAIris(r: Reflexo): Reflexo {
  const d = Math.hypot(r.x, r.y);
  if (d <= IRIS_RAIO_MM) return r;
  return { x: (r.x * IRIS_RAIO_MM) / d, y: (r.y * IRIS_RAIO_MM) / d };
}
