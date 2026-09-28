/**
 * Respiração guiada 4-7-8 (inspire 4 s, sustenha 7 s, expire 8 s) -- a
 * mecânica do antigo exercício "Relaxamento e Respiração", agora usada como
 * pausa entre blocos dos treinos. Não é tratamento: é só uma pausa.
 */

export type FaseRespiracao = "inspire" | "sustenha" | "expire";

const FASES: readonly FaseRespiracao[] = ["inspire", "sustenha", "expire"];
export const DURACOES_FASE_MS = [4000, 7000, 8000] as const;
export const CICLO_RESPIRACAO_MS = DURACOES_FASE_MS.reduce((s, ms) => s + ms, 0);

export const ORBE_ESCALA_MIN = 1;
export const ORBE_ESCALA_MAX = 1.55;

/** Smoothstep: a orbe acelera e desacelera, como uma respiração real. */
const suavizar = (p: number) => p * p * (3 - 2 * p);

export function faseRespiracao(elapsedMs: number): { fase: FaseRespiracao; escala: number } {
  // Aqui o módulo é intencional e seguro: a escala não é um ângulo -- cada
  // fase recomeça numa escala conhecida, por isso não há salto visível.
  const t = elapsedMs % CICLO_RESPIRACAO_MS;
  let acumulado = 0;
  for (let i = 0; i < FASES.length; i++) {
    const duracao = DURACOES_FASE_MS[i];
    if (t < acumulado + duracao) {
      const p = suavizar((t - acumulado) / duracao);
      const escala =
        i === 0
          ? ORBE_ESCALA_MIN + (ORBE_ESCALA_MAX - ORBE_ESCALA_MIN) * p
          : i === 1
            ? ORBE_ESCALA_MAX
            : ORBE_ESCALA_MAX - (ORBE_ESCALA_MAX - ORBE_ESCALA_MIN) * p;
      return { fase: FASES[i], escala };
    }
    acumulado += duracao;
  }
  return { fase: "inspire", escala: ORBE_ESCALA_MIN };
}
