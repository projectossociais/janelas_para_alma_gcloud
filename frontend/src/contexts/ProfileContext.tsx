import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Profile {
  id: string;
  nome_completo: string;
  email: string;
  biografia: string | null;
  data_nascimento: string | null;
  genero: string | null;
  telefone: string | null;
  provincia: string | null;
  avatar_url: string | null;
  papel: string;
  notificacoes_projetos: boolean;
  notificacoes_lembretes: boolean;
  notificacoes_comunidade: boolean;
  created_at: string;
}

interface ProfileContextValue {
  profile: Profile | null;
  loading: boolean;
  refetch: () => Promise<void>;
  /** Actualiza o estado local sem novo pedido -- usar depois de um update bem-sucedido. */
  setProfile: (profile: Profile) => void;
}

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

/**
 * Fonte única da linha `profiles` do utilizador com sessão iniciada.
 *
 * Existe como contexto (e não como hook por-componente) precisamente para
 * que um `setProfile` chamado em "Editar Perfil" se reflicta de imediato em
 * qualquer outro consumidor -- nomeadamente o nome/iniciais na Navbar --
 * sem depender de um refetch ou de um reload da página.
 */
export const ProfileProvider = ({ children }: { children: ReactNode }) => {
  const [profile, setProfileState] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user.id ?? null;
    if (!mountedRef.current) return;

    if (!uid) {
      setProfileState(null);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", uid)
      .single();
    if (!mountedRef.current) return;

    if (error) {
      console.error("Falha ao carregar o perfil:", error);
      setProfileState(null);
    } else {
      setProfileState(data as Profile);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      load();
    });
    return () => {
      mountedRef.current = false;
      sub.subscription.unsubscribe();
    };
  }, [load]);

  return (
    <ProfileContext.Provider value={{ profile, loading, refetch: load, setProfile: setProfileState }}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = (): ProfileContextValue => {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile deve ser usado dentro de <ProfileProvider>.");
  return ctx;
};
