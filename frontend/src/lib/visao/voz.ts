/**
 * O som dos exercícios: só bips curtos, sem voz (a narração falada saiu em
 * 2026-10-31 -- era ineficaz; as instruções estão todas no ecrã). É opcional
 * e começa desligado: nenhum exercício faz bips sem a pessoa ligar o som
 * (`BotaoSom`, sempre à vista durante o exercício). A escolha fica guardada
 * no aparelho.
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
  window.dispatchEvent(new Event(EVENTO_SOM));
}

/** Avisa quando o som é ligado ou desligado; devolve a função para deixar de ouvir. */
export function aoMudarSom(fn: () => void): () => void {
  window.addEventListener(EVENTO_SOM, fn);
  return () => window.removeEventListener(EVENTO_SOM, fn);
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
