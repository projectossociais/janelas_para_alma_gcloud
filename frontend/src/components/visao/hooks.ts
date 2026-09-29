import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/contexts/ProfileContext";
import {
  perfilApi,
  sessoesExercicioApi,
  type BonusAssiduidade,
  type SessaoExercicioInput,
  type SessaoExercicioPublica,
} from "@/lib/apiClient";
import {
  SEM_CARTAO,
  guardarCalibracao,
  lerCalibracao,
  pxPorMmValido,
  type Calibracao,
} from "@/lib/visao/calibracao";
import { ContadorTempoActivo } from "@/lib/visao/tempoActivo";

/**
 * Calibração do ecrã: localStorage primeiro (é por aparelho), depois o
 * perfil. `null` enquanto o utilizador não calibrou nem escolheu "não tenho
 * cartão".
 */
export function useCalibracao() {
  const { isLoggedIn } = useAuth();
  const { profile, setProfile } = useProfile();
  const [calibracao, setCalibracao] = useState<Calibracao | null>(() => lerCalibracao());

  // Sem calibração local, aproveita a do perfil (mesma conta, outro dia).
  useEffect(() => {
    if (calibracao === null && pxPorMmValido(profile?.px_por_mm)) {
      setCalibracao({ pxPorMm: profile!.px_por_mm as number, calibrado: true });
    }
  }, [calibracao, profile]);

  const guardar = useCallback(
    (c: Calibracao) => {
      setCalibracao(c);
      guardarCalibracao(c);
      // Só uma calibração real vai para o perfil. Falhar aqui não é grave --
      // a calibração local já está guardada -- por isso não se mostra erro,
      // e também nunca se mostra "guardado" sem a resposta da API.
      if (c.calibrado && isLoggedIn) {
        perfilApi
          .atualizar({ px_por_mm: Math.round(c.pxPorMm * 1000) / 1000 })
          .then((p) => profile && setProfile({ ...profile, px_por_mm: p.px_por_mm ?? null }))
          .catch(() => undefined);
      }
    },
    [isLoggedIn, profile, setProfile],
  );

  return { calibracao, guardar, semCartao: () => guardar(SEM_CARTAO) };
}

/** `window.devicePixelRatio`, actualizado se a janela mudar de ecrã/zoom. */
export function useDevicePixelRatio(): number {
  const [dpr, setDpr] = useState(() => (typeof window === "undefined" ? 1 : window.devicePixelRatio || 1));
  useEffect(() => {
    const aoMudar = () => setDpr(window.devicePixelRatio || 1);
    window.addEventListener("resize", aoMudar);
    return () => window.removeEventListener("resize", aoMudar);
  }, []);
  return dpr;
}

/**
 * Tempo activo (ver `lib/visao/tempoActivo.ts`) ligado ao
 * `visibilitychange` do documento. `emPausa` é revisto a cada segundo.
 */
export function useTempoActivo() {
  const contador = useRef(new ContadorTempoActivo());
  const [emPausa, setEmPausa] = useState(true);
  const [segundos, setSegundos] = useState(0);
  const [activo, setActivo] = useState(false);

  useEffect(() => {
    const aoMudar = () => contador.current.definirVisivel(document.visibilityState === "visible", performance.now());
    document.addEventListener("visibilitychange", aoMudar);
    return () => document.removeEventListener("visibilitychange", aoMudar);
  }, []);

  useEffect(() => {
    if (!activo) return;
    const id = window.setInterval(() => {
      setEmPausa(contador.current.emPausa(performance.now()));
      setSegundos(contador.current.segundos);
    }, 1000);
    return () => window.clearInterval(id);
  }, [activo]);

  const iniciar = useCallback(() => {
    contador.current.iniciar(performance.now());
    setActivo(true);
    setEmPausa(false);
  }, []);
  const registar = useCallback(() => {
    contador.current.registarResposta(performance.now());
    setEmPausa(false);
    setSegundos(contador.current.segundos);
  }, []);
  const pausar = useCallback(() => {
    contador.current.pausar();
    setActivo(false);
    setEmPausa(true);
  }, []);

  return {
    iniciar,
    registar,
    pausar,
    emPausa,
    segundos,
    /** Leitura imediata (sem esperar pelo intervalo de 1 s). */
    lerSegundos: () => contador.current.segundos,
  };
}

export type EstadoGravacao = "parado" | "a_gravar" | "gravado" | "erro";

/**
 * Grava sessões de exercício (versão 2). Nunca mostra "gravado" antes da
 * resposta da API; num erro, guarda o pedido para "Tentar de novo".
 */
export function useRegistoSessao() {
  const [estado, setEstado] = useState<EstadoGravacao>("parado");
  const [bonus, setBonus] = useState<BonusAssiduidade | null>(null);
  const pendentes = useRef<SessaoExercicioInput[]>([]);

  const enviar = useCallback(async () => {
    setEstado("a_gravar");
    try {
      while (pendentes.current.length) {
        const gravada = await sessoesExercicioApi.registar(pendentes.current[0]);
        if (gravada?.bonus) setBonus(gravada.bonus);
        pendentes.current.shift();
      }
      setEstado("gravado");
    } catch {
      setEstado("erro");
    }
  }, []);

  const gravar = useCallback(
    (sessoes: SessaoExercicioInput[]) => {
      pendentes.current.push(...sessoes.map((s) => ({ ...s, versao: 2 as const })));
      return enviar();
    },
    [enviar],
  );

  return { estado, gravar, tentarDeNovo: enviar, bonus };
}

/** Histórico de sessões versão 2 do próprio utilizador (para limiares e progresso). */
export function useHistoricoVisao(desde?: string) {
  const { isLoggedIn } = useAuth();
  const [sessoes, setSessoes] = useState<SessaoExercicioPublica[] | null>(null);
  const [erro, setErro] = useState(false);

  const carregar = useCallback(async () => {
    if (!isLoggedIn) {
      setSessoes([]);
      return;
    }
    setErro(false);
    try {
      setSessoes(await sessoesExercicioApi.minhas(desde));
    } catch {
      setErro(true);
      setSessoes(null);
    }
  }, [isLoggedIn, desde]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const ultimo = useMemo(
    () => (exercicioId: string, olho: string) =>
      (sessoes ?? []).find((s) => s.exercicio_id === exercicioId && s.olho === olho && s.limiar !== null) ?? null,
    [sessoes],
  );

  return { sessoes, erro, carregando: sessoes === null && !erro, recarregar: carregar, ultimo };
}
