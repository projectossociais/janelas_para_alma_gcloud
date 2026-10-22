/**
 * Instruções faladas (síntese de voz do próprio aparelho), para crianças e
 * para quem lê com dificuldade. Sem rede nem custos; se o aparelho não tiver
 * voz no idioma, usa a que houver -- e sem síntese nenhuma, o botão nem
 * aparece.
 */

export const vozDisponivel = (): boolean => typeof window !== "undefined" && "speechSynthesis" in window;

/*
 * O som é opcional e começa desligado: nenhum exercício fala nem faz bips
 * sozinho sem a pessoa ligar o som (`BotaoSom`, sempre à vista durante o
 * exercício). A escolha fica guardada no aparelho. "Ouvir as instruções" é um
 * pedido explícito e fala mesmo com o som desligado -- e pode ser parado.
 */
const CHAVE_SOM = "jpa.visao.som";
const EVENTO_SOM = "jpa:visao-som";
/** Se o armazenamento estiver bloqueado, a escolha dura enquanto a página estiver aberta. */
let somEmMemoria = false;

export function somLigado(): boolean {
  try {
    const v = window.localStorage.getItem(CHAVE_SOM);
    return v === null ? somEmMemoria : v === "1";
  } catch {
    return somEmMemoria;
  }
}

export function definirSom(ligado: boolean): void {
  somEmMemoria = ligado;
  try {
    window.localStorage.setItem(CHAVE_SOM, ligado ? "1" : "0");
  } catch {
    // armazenamento bloqueado: fica em memória
  }
  if (!ligado) calar();
  window.dispatchEvent(new Event(EVENTO_SOM));
}

/** Avisa quando o som é ligado ou desligado; devolve a função para deixar de ouvir. */
export function aoMudarSom(fn: () => void): () => void {
  window.addEventListener(EVENTO_SOM, fn);
  return () => window.removeEventListener(EVENTO_SOM, fn);
}

interface OpcoesFala {
  /** Pedido explícito ("Ouvir as instruções"): fala mesmo com o som desligado. */
  pedido?: boolean;
  /** Quando acaba (ou é interrompido). */
  aoAcabar?: () => void;
}

/**
 * Fala o texto no idioma do site ("pt-AO" usa a voz portuguesa que houver).
 * Sem o som ligado, só fala o que foi pedido. Devolve se começou a falar.
 */
export function falar(texto: string, idioma: string, opcoes: OpcoesFala = {}): boolean {
  if (!vozDisponivel() || (!opcoes.pedido && !somLigado())) return false;
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
  if (opcoes.aoAcabar) {
    u.onend = opcoes.aoAcabar;
    u.onerror = opcoes.aoAcabar;
  }
  sintese.speak(u);
  return true;
}

export function calar(): void {
  if (vozDisponivel()) window.speechSynthesis.cancel();
}

let audio: AudioContext | null = null;

/**
 * Um som curto (WebAudio), para quem não está a ver o ecrã saber que a
 * resposta contou: "tic" registou, "fim" terminou um olho ou uma ronda. Só
 * com o som ligado.
 */
export function sinalSonoro(tipo: "tic" | "certo" | "errado" | "fim" | "festa" = "tic"): void {
  if (!somLigado()) return;
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
