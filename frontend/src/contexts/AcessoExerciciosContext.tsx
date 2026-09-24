import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { exerciciosApi, type AcessoExerciciosPublico } from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/contexts/ProfileContext";

/** Ids dos exercícios, tal como a API os conhece (`sessoes_exercicio.exercicio_id`). */
export const EXERCICIOS_TRIAL = ["figure8", "convergence", "cerebro", "relax"] as const;
export const EXERCICIOS_PREMIUM = [
  "ambliopia",
  "sacadas-convergencia",
  "flexibilidade-acomodativa",
  "estereopsia",
] as const;

const SEM_SESSAO: AcessoExerciciosPublico = {
  estado: "sem_sessao",
  exercicios_desbloqueados: [],
  exercicios_trial: [...EXERCICIOS_TRIAL],
  exercicios_premium: [...EXERCICIOS_PREMIUM],
  trial_iniciado_em: null,
  trial_termina_em: null,
  trial_dias_restantes: null,
};

interface AcessoExerciciosContextType {
  acesso: AcessoExerciciosPublico;
  loading: boolean;
  temAcesso: (exercicioId: string) => boolean;
  /** Levanta o erro da API (ex.: 409 se o teste já foi usado) -- quem chama
   *  decide o que mostrar; nunca mostra sucesso a partir de um `catch`. */
  iniciarTrial: () => Promise<AcessoExerciciosPublico>;
  refetch: () => Promise<void>;
}

const AcessoExerciciosContext = createContext<AcessoExerciciosContextType | undefined>(undefined);

/**
 * Estado de acesso aos exercícios (Premium / teste de 7 dias), partilhado
 * entre a página /exercicios, cada exercício e o painel. Só espelha o que a
 * API decide -- bloquear aqui é conveniência de interface, a garantia real
 * é a API recusar sessões e vídeos sem direito de acesso.
 */
export const AcessoExerciciosProvider = ({ children }: { children: ReactNode }) => {
  const { isLoggedIn, loading: authLoading } = useAuth();
  const { profile } = useProfile();
  const [acesso, setAcesso] = useState<AcessoExerciciosPublico>(SEM_SESSAO);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!isLoggedIn) {
      setAcesso(SEM_SESSAO);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setAcesso(await exerciciosApi.acesso());
    } catch {
      // Sem resposta da API, fica tudo bloqueado -- nunca desbloquear por omissão.
      setAcesso({ ...SEM_SESSAO, estado: "trial_terminado" });
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn]);

  // Recarrega quando a sessão muda e quando o Premium/papel do perfil muda
  // (ex.: um admin aprova o pagamento e o perfil é recarregado).
  useEffect(() => {
    if (authLoading) return;
    void load();
  }, [authLoading, load, profile?.premium_ativo, profile?.papel]);

  const iniciarTrial = useCallback(async () => {
    const novo = await exerciciosApi.iniciarTrial();
    setAcesso(novo);
    return novo;
  }, []);

  const temAcesso = useCallback(
    (exercicioId: string) => acesso.exercicios_desbloqueados.includes(exercicioId),
    [acesso],
  );

  return (
    <AcessoExerciciosContext.Provider value={{ acesso, loading, temAcesso, iniciarTrial, refetch: load }}>
      {children}
    </AcessoExerciciosContext.Provider>
  );
};

export const useAcessoExercicios = () => {
  const ctx = useContext(AcessoExerciciosContext);
  if (!ctx) throw new Error("useAcessoExercicios deve ser usado dentro de <AcessoExerciciosProvider>.");
  return ctx;
};
