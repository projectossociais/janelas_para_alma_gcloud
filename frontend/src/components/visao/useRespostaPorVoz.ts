import { useEffect, useRef, useState } from "react";
import { direccaoDaFala, type RespostaE } from "@/lib/visao/palancaLonge";

interface Reconhecimento {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type ConstrutorReconhecimento = new () => Reconhecimento;

const construtor = (): ConstrutorReconhecimento | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: ConstrutorReconhecimento; webkitSpeechRecognition?: ConstrutorReconhecimento };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

/** O aparelho reconhece a fala (Chrome no Android, Safari recente)? */
export const reconhecimentoDisponivel = (): boolean => construtor() !== null;

/**
 * Ouve as respostas da criança ("cima", "esquerda", "não sei") enquanto
 * `activo`. O microfone só se pede quando o adulto liga a opção; sem
 * permissão ou sem reconhecimento, `erro` fica a true e o teste continua só
 * com o deslize do adulto.
 */
export function useRespostaPorVoz(activo: boolean, idioma: string, aoOuvir: (r: RespostaE) => void) {
  const [aOuvir, setAOuvir] = useState(false);
  const [erro, setErro] = useState(false);
  const aoOuvirRef = useRef(aoOuvir);
  aoOuvirRef.current = aoOuvir;

  useEffect(() => {
    const C = construtor();
    if (!activo || !C) return;
    let parado = false;
    const r = new C();
    r.lang = idioma.startsWith("pt") ? "pt-PT" : "en-US";
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (!res.isFinal) continue;
        const resposta = direccaoDaFala(res[0]?.transcript ?? "");
        if (resposta) aoOuvirRef.current(resposta);
      }
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed" || e.error === "audio-capture") {
        parado = true;
        setErro(true);
        setAOuvir(false);
      }
    };
    // O reconhecimento pára sozinho depois de algum silêncio: recomeça enquanto estiver ligado.
    r.onend = () => {
      if (parado) return;
      try {
        r.start();
      } catch {
        setAOuvir(false);
      }
    };
    try {
      r.start();
      setAOuvir(true);
    } catch {
      setErro(true);
    }
    return () => {
      parado = true;
      setAOuvir(false);
      try {
        r.stop();
      } catch {
        // já parado
      }
    };
  }, [activo, idioma]);

  return { aOuvir, erro };
}
