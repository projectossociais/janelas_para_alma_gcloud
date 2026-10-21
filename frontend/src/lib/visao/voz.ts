/**
 * Instruções faladas (síntese de voz do próprio aparelho), para crianças e
 * para quem lê com dificuldade. Sem rede nem custos; se o aparelho não tiver
 * voz no idioma, usa a que houver -- e sem síntese nenhuma, o botão nem
 * aparece.
 */

export const vozDisponivel = (): boolean => typeof window !== "undefined" && "speechSynthesis" in window;

/** Fala o texto no idioma do site ("pt-AO" usa a voz portuguesa que houver). */
export function falar(texto: string, idioma: string): void {
  if (!vozDisponivel()) return;
  const sintese = window.speechSynthesis;
  sintese.cancel();
  const base = idioma.slice(0, 2).toLowerCase();
  const vozes = sintese.getVoices();
  const voz =
    vozes.find((v) => v.lang.toLowerCase().replace("_", "-") === (base === "pt" ? "pt-pt" : idioma.toLowerCase())) ??
    vozes.find((v) => v.lang.toLowerCase().startsWith(base)) ??
    null;
  const u = new SpeechSynthesisUtterance(texto);
  u.lang = voz?.lang ?? (base === "pt" ? "pt-PT" : idioma);
  if (voz) u.voice = voz;
  u.rate = 0.95;
  sintese.speak(u);
}

export function calar(): void {
  if (vozDisponivel()) window.speechSynthesis.cancel();
}
