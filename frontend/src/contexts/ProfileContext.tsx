import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { perfilApi, type PerfilPublico } from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";

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

const paraProfile = (p: PerfilPublico): Profile => ({
  id: p.id,
  nome_completo: p.nome_completo ?? "",
  email: p.email,
  biografia: p.biografia,
  data_nascimento: p.data_nascimento,
  genero: p.genero,
  telefone: p.telefone,
  provincia: p.provincia,
  avatar_url: p.avatar_url,
  papel: p.papel,
  notificacoes_projetos: p.notificacoes_projetos,
  notificacoes_lembretes: p.notificacoes_lembretes,
  notificacoes_comunidade: p.notificacoes_comunidade,
  created_at: p.criado_em,
});

interface ProfileContextValue {
  profile: Profile | null;
  loading: boolean;
  refetch: () => Promise<void>;
  /** Actualiza o estado local sem novo pedido -- usar depois de um update bem-sucedido. */
  setProfile: (profile: Profile) => void;
}

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

/**
 * Fonte única do perfil do utilizador com sessão iniciada — agora vindo da
 * API própria (`GET /perfil`), não do Supabase. Existe como contexto para
 * que um `setProfile` chamado em "Editar Perfil" se reflicta de imediato em
 * qualquer outro consumidor (ex.: nome/avatar na Navbar) sem refetch.
 *
 * Gap conhecido (ver CLAUDE.md secção 0 / docs/BACKLOG.md): páginas de
 * exercícios ainda gravam `sessoes_exercicio` directamente no Supabase
 * usando `profile.id` como `user_id` — isso continua a exigir uma sessão
 * Supabase própria, que uma conta criada pela API nova não tem. Migrar
 * essas páginas é trabalho later, não desta sprint.
 */
export const ProfileProvider = ({ children }: { children: ReactNode }) => {
  const { isLoggedIn, loading: authLoading } = useAuth();
  const [profile, setProfileState] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    if (!isLoggedIn) {
      setProfileState(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const perfil = await perfilApi.obter();
      if (!mountedRef.current) return;
      setProfileState(paraProfile(perfil));
    } catch (err) {
      if (!mountedRef.current) return;
      console.error("Falha ao carregar o perfil:", err);
      setProfileState(null);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    mountedRef.current = true;
    // Espera a verificação inicial da sessão terminar — evita um pedido a
    // /perfil destinado a falhar enquanto ainda não se sabe se há sessão.
    if (!authLoading) void load();
    return () => {
      mountedRef.current = false;
    };
  }, [authLoading, load]);

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
