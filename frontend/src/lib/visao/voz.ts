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

let audio: AudioContext | null = null;

/**
 * Um som curto (WebAudio), para quem não está a ver o ecrã saber que a
 * resposta contou: "tic" registou, "fim" terminou um olho ou uma ronda.
 */
export function sinalSonoro(tipo: "tic" | "certo" | "errado" | "fim" | "festa" = "tic"): void {
  try {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return;
    const a = (audio = audio ?? new C());
    const notas = { tic: [990], certo: [660, 880], errado: [220, 165], fim: [880, 660], festa: [523, 659, 784, 1046] }[tipo];
    notas.forEach((f, i) => {
      const o = a.createOscillator();
      const g = a.createGain();
      const t0 = a.currentTime + i * 0.1;
      o.type = tipo === "errado" ? "triangle" : "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.2, t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.17);
      o.connect(g).connect(a.destination);
      o.start(t0);
      o.stop(t0 + 0.2);
    });
  } catch {
    // sem áudio: o teste continua
  }
}
