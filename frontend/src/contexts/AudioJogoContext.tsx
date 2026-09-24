import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

export type EfeitoSonoro = "certo" | "errado" | "clique" | "levelUp";

// Ficheiros em public/audio/jogo -- provisórios, gerados por
// scripts/gerar-sons-jogo.mjs. Trocar por gravações reais é só substituir os
// ficheiros com o mesmo nome.
const FICHEIROS_EFEITOS: Record<EfeitoSonoro, string> = {
  certo: "/audio/jogo/certo.wav",
  errado: "/audio/jogo/errado.wav",
  clique: "/audio/jogo/clique.wav",
  levelUp: "/audio/jogo/level-up.wav",
};
const FICHEIRO_MUSICA = "/audio/jogo/musica-fundo.wav";
const VOLUME_MUSICA = 0.25;
const VOLUME_EFEITOS = 0.6;

export const CHAVE_PREFERENCIAS_AUDIO = "jogo.preferenciasAudio";

export interface PreferenciasAudio {
  musica: boolean;
  efeitos: boolean;
}

const PREFERENCIAS_POR_OMISSAO: PreferenciasAudio = { musica: true, efeitos: true };

/** Lê as preferências guardadas neste dispositivo. O `localStorage` pode não
 *  existir ou lançar (janela privada, dados bloqueados) -- nesse caso valem as
 *  de omissão, sem nunca rebentar o jogo. */
export function lerPreferenciasAudio(): PreferenciasAudio {
  try {
    const guardado = JSON.parse(window.localStorage.getItem(CHAVE_PREFERENCIAS_AUDIO) ?? "null");
    if (guardado && typeof guardado === "object") {
      return {
        musica: typeof guardado.musica === "boolean" ? guardado.musica : PREFERENCIAS_POR_OMISSAO.musica,
        efeitos: typeof guardado.efeitos === "boolean" ? guardado.efeitos : PREFERENCIAS_POR_OMISSAO.efeitos,
      };
    }
  } catch {
    // JSON inválido ou armazenamento indisponível -- usa as de omissão.
  }
  return PREFERENCIAS_POR_OMISSAO;
}

function guardarPreferenciasAudio(preferencias: PreferenciasAudio): void {
  try {
    window.localStorage.setItem(CHAVE_PREFERENCIAS_AUDIO, JSON.stringify(preferencias));
  } catch {
    // Sem armazenamento a preferência vale só até fechar a página.
  }
}

interface AudioJogoContextType extends PreferenciasAudio {
  definirMusica: (ligada: boolean) => void;
  definirEfeitos: (ligados: boolean) => void;
  tocarEfeito: (efeito: EfeitoSonoro) => void;
  /** Uso interno de `useMusicaDeFundo`. */
  pedirMusica: () => () => void;
}

const AudioJogoContext = createContext<AudioJogoContextType | undefined>(undefined);

/**
 * Som do jogo -- música de fundo e efeitos, com as preferências do jogador
 * (Definições) guardadas no `localStorage` deste dispositivo.
 *
 * Política de autoplay dos browsers: nada toca antes do primeiro toque ou
 * tecla do jogador na página (`desbloqueado`). A música só toca enquanto
 * alguma página a pedir (`useMusicaDeFundo`) e pára quando a página fica
 * escondida (outro separador, ecrã bloqueado).
 */
export const AudioJogoProvider = ({ children }: { children: ReactNode }) => {
  const [preferencias, setPreferencias] = useState<PreferenciasAudio>(lerPreferenciasAudio);
  const [desbloqueado, setDesbloqueado] = useState(false);
  const [pedidosMusica, setPedidosMusica] = useState(0);
  const [visivel, setVisivel] = useState(() => typeof document === "undefined" || !document.hidden);
  const musica = useRef<HTMLAudioElement | null>(null);
  const efeitos = useRef<Partial<Record<EfeitoSonoro, HTMLAudioElement>>>({});

  // Primeiro gesto do jogador -- a partir daqui o browser deixa tocar som.
  useEffect(() => {
    if (desbloqueado) return;
    const desbloquear = () => setDesbloqueado(true);
    const opcoes = { once: true, capture: true } as const;
    window.addEventListener("pointerdown", desbloquear, opcoes);
    window.addEventListener("keydown", desbloquear, opcoes);
    window.addEventListener("touchstart", desbloquear, opcoes);
    return () => {
      window.removeEventListener("pointerdown", desbloquear, opcoes);
      window.removeEventListener("keydown", desbloquear, opcoes);
      window.removeEventListener("touchstart", desbloquear, opcoes);
    };
  }, [desbloqueado]);

  useEffect(() => {
    const aoMudarVisibilidade = () => setVisivel(!document.hidden);
    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    return () => document.removeEventListener("visibilitychange", aoMudarVisibilidade);
  }, []);

  const deveTocarMusica = preferencias.musica && desbloqueado && visivel && pedidosMusica > 0;
  useEffect(() => {
    if (deveTocarMusica) {
      if (!musica.current) {
        musica.current = new Audio(FICHEIRO_MUSICA);
        musica.current.loop = true;
        musica.current.volume = VOLUME_MUSICA;
      }
      musica.current.play()?.catch(() => {
        // Recusado pelo browser (ex.: gesto ainda não contou) -- sem som, sem erro.
      });
    } else {
      musica.current?.pause();
    }
  }, [deveTocarMusica]);

  useEffect(() => () => musica.current?.pause(), []);

  const definirMusica = useCallback((ligada: boolean) => {
    setPreferencias((atuais) => {
      const novas = { ...atuais, musica: ligada };
      guardarPreferenciasAudio(novas);
      return novas;
    });
  }, []);

  const definirEfeitos = useCallback((ligados: boolean) => {
    setPreferencias((atuais) => {
      const novas = { ...atuais, efeitos: ligados };
      guardarPreferenciasAudio(novas);
      return novas;
    });
  }, []);

  const tocarEfeito = useCallback(
    (efeito: EfeitoSonoro) => {
      if (!preferencias.efeitos || !desbloqueado) return;
      let audio = efeitos.current[efeito];
      if (!audio) {
        audio = new Audio(FICHEIROS_EFEITOS[efeito]);
        audio.volume = VOLUME_EFEITOS;
        efeitos.current[efeito] = audio;
      }
      audio.currentTime = 0;
      audio.play()?.catch(() => {
        // Sem som não é erro -- o jogo continua.
      });
    },
    [preferencias.efeitos, desbloqueado]
  );

  const pedirMusica = useCallback(() => {
    setPedidosMusica((n) => n + 1);
    return () => setPedidosMusica((n) => Math.max(0, n - 1));
  }, []);

  return (
    <AudioJogoContext.Provider
      value={{ ...preferencias, definirMusica, definirEfeitos, tocarEfeito, pedirMusica }}
    >
      {children}
    </AudioJogoContext.Provider>
  );
};

export const useAudioJogo = () => {
  const ctx = useContext(AudioJogoContext);
  if (!ctx) throw new Error("useAudioJogo deve ser usado dentro de AudioJogoProvider");
  return ctx;
};

/** Pede música de fundo enquanto `ativa` (e a página estiver montada). */
export const useMusicaDeFundo = (ativa: boolean) => {
  const { pedirMusica } = useAudioJogo();
  useEffect(() => {
    if (!ativa) return;
    return pedirMusica();
  }, [ativa, pedirMusica]);
};
