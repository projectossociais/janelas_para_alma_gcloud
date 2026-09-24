/**
 * Apresentação do Mercado (ajuda paga do jogo). Custo, precisão e bloqueio
 * são decididos pela API (`MercadoJogoService`) -- aqui só se formata o que
 * ela devolve.
 */

export type NivelCerteza = "baixa" | "media" | "alta" | "muitoAlta";

/** Rótulo de certeza a partir da precisão (0-1) que a API devolve. */
export function nivelDeCerteza(precisao: number): NivelCerteza {
  if (precisao >= 0.9) return "muitoAlta";
  if (precisao >= 0.8) return "alta";
  if (precisao >= 0.6) return "media";
  return "baixa";
}

/**
 * Milissegundos que faltam até `disponivelEm`, medidos no relógio do
 * servidor: `desvioMs` é (hora do servidor - hora do dispositivo) no momento
 * em que o Mercado foi carregado. Um dispositivo com o relógio adiantado ou
 * atrasado continua a mostrar o tempo certo. Nunca negativo.
 */
export function msRestantes(disponivelEm: string | null, agoraDispositivoMs: number, desvioMs: number): number {
  if (!disponivelEm) return 0;
  return Math.max(0, new Date(disponivelEm).getTime() - (agoraDispositivoMs + desvioMs));
}

/** "HH:MM:SS" -- arredonda para cima, para nunca mostrar 00:00:00 com o bloqueio ainda activo. */
export function formatarTempoRestante(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const segundos = total % 60;
  return [horas, minutos, segundos].map((n) => String(n).padStart(2, "0")).join(":");
}
